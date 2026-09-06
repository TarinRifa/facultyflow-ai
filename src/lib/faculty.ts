import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, transaction } from "./db";
import { ApiError } from "./api-error";
import { generateJson, embedTexts, cosine } from "./faculty-ai";
import { z } from "zod";
import type { z as zType } from "zod";
import crypto from "node:crypto";
import { getAcademicSettings } from "./admin";
import {
  courseSchema,
  syllabusSchema,
  routineSchema,
  plannerSchema,
  assessmentUpdateSchema,
  generatorSchema,
  questionUpdateSchema,
  roadmapSchema,
} from "./faculty-validation";

const calendarDate = (value: unknown) =>
  value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);

async function ownedCourse(userId: string, courseId: string) {
  const result = await db.query(
    "select * from public.courses where id=$1 and user_id=$2",
    [courseId, userId],
  );
  if (!result.rows[0]) throw new ApiError(404, "Course not found.");
  return result.rows[0];
}
async function ownedAssessment(userId: string, id: string) {
  const result = await db.query(
    "select a.* from public.assessments a join public.courses c on c.id=a.course_id where a.id=$1 and c.user_id=$2",
    [id, userId],
  );
  if (!result.rows[0]) throw new ApiError(404, "Assessment not found.");
  return result.rows[0];
}
export async function facultyWorkspace(userId: string) {
  const [
    courses,
    syllabi,
    routines,
    assessments,
    analyses,
    papers,
    questions,
    notifications,
    roadmap,
  ] = await Promise.all([
    db.query("select * from public.courses where user_id=$1 order by code", [
      userId,
    ]),
    db.query(
      "select s.* from public.syllabi s join public.courses c on c.id=s.course_id where c.user_id=$1",
      [userId],
    ),
    db.query(
      "select r.* from public.class_routines r join public.courses c on c.id=r.course_id where c.user_id=$1 order by weekday,start_time",
      [userId],
    ),
    db.query(
      "select a.* from public.assessments a join public.courses c on c.id=a.course_id where c.user_id=$1 order by scheduled_on",
      [userId],
    ),
    db.query(
      "select a.id,a.course_id,a.filename,a.file_type,a.ai_likelihood,a.similarity_percent,a.flags,a.matched_analysis_id,a.disclaimer,a.created_at from public.assignment_analyses a join public.courses c on c.id=a.course_id where c.user_id=$1 order by a.created_at desc limit 50",
      [userId],
    ),
    db.query(
      "select p.id,p.course_id,p.year,p.filename,p.created_at,count(q.id)::int question_count from public.previous_papers p join public.courses c on c.id=p.course_id left join public.previous_questions q on q.paper_id=p.id where c.user_id=$1 group by p.id order by p.year desc",
      [userId],
    ),
    db.query(
      "select g.*,(select question_text from public.previous_questions where id=g.matched_question_id) matched_question,(select p.year from public.previous_questions q join public.previous_papers p on p.id=q.paper_id where q.id=g.matched_question_id) matched_year from public.generated_questions g join public.courses c on c.id=g.course_id where c.user_id=$1 order by g.created_at desc",
      [userId],
    ),
    db.query(
      "select n.* from public.notifications n where n.user_id=$1 order by n.is_read,n.created_at desc limit 100",
      [userId],
    ),
    db.query(
      "select i.*,c.code,c.title,a.title assessment_title from public.roadmap_items i join public.roadmap_runs r on r.id=i.run_id join public.courses c on c.id=i.course_id left join public.assessments a on a.id=i.assessment_id where r.user_id=$1 and r.id=(select id from public.roadmap_runs where user_id=$1 order by created_at desc limit 1) order by i.recommended_on",
      [userId],
    ),
  ]);
  return {
    courses: courses.rows,
    syllabi: syllabi.rows,
    routines: routines.rows,
    assessments: assessments.rows,
    analyses: analyses.rows,
    papers: papers.rows,
    questions: questions.rows,
    notifications: notifications.rows,
    roadmap: roadmap.rows,
  };
}
export async function createCourse(
  userId: string,
  input: zType.infer<typeof courseSchema>,
) {
  try {
    return (
      await db.query(
        "insert into public.courses(user_id,code,title,semester_start,semester_end) values($1,$2,$3,$4,$5) returning *",
        [
          userId,
          input.code,
          input.title,
          input.semester_start,
          input.semester_end,
        ],
      )
    ).rows[0];
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      throw new ApiError(409, "That course code already exists.");
    throw e;
  }
}
export async function saveSyllabus(
  userId: string,
  input: zType.infer<typeof syllabusSchema>,
) {
  await ownedCourse(userId, input.course_id);
  return (
    await db.query(
      `insert into public.syllabi(course_id,content,source_name,clos,topics,progress_percent) values($1,$2,$3,$4,$5,$6) on conflict(course_id) do update set content=excluded.content,source_name=excluded.source_name,clos=excluded.clos,topics=excluded.topics,progress_percent=excluded.progress_percent returning *`,
      [
        input.course_id,
        input.content,
        input.source_name,
        JSON.stringify(input.clos),
        JSON.stringify(input.topics),
        input.progress_percent,
      ],
    )
  ).rows[0];
}
export async function addRoutine(
  userId: string,
  input: zType.infer<typeof routineSchema>,
) {
  await ownedCourse(userId, input.course_id);
  try {
    return (
      await db.query(
        "insert into public.class_routines(course_id,weekday,start_time,end_time,room) values($1,$2,$3,$4,$5) returning *",
        [
          input.course_id,
          input.weekday,
          input.start_time,
          input.end_time,
          input.room,
        ],
      )
    ).rows[0];
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      throw new ApiError(409, "That class routine already exists.");
    throw e;
  }
}

const flagSchema = z.strictObject({
  start: z.number().int().min(0),
  end: z.number().int().positive(),
  excerpt: z.string().max(500),
  reason: z.string().max(500),
});
const analysisSchema = z.strictObject({
  ai_likelihood: z.number().min(0).max(100),
  flags: z.array(flagSchema).max(30),
});
export async function analyzeAssignment(
  userId: string,
  courseId: string,
  file: { filename: string; file_type: string; text: string },
) {
  await ownedCourse(userId, courseId);
  const contentHash = crypto
    .createHash("sha256")
    .update(file.text)
    .digest("hex");
  const duplicate = await db.query(
    "select id from public.assignment_analyses where course_id=$1 and content_hash=$2",
    [courseId, contentHash],
  );
  if (duplicate.rows[0])
    throw new ApiError(
      409,
      "This assignment content has already been analyzed.",
    );
  const ai = await generateJson(
    analysisSchema,
    "Estimate patterns associated with AI-assisted writing. This is only an indicator, never proof. Flag exact character ranges supported by the submitted text. Do not make disciplinary conclusions.",
    { text: file.text },
  );
  const safeFlags = ai.flags
    .filter(
      (f) =>
        f.start < f.end &&
        f.end <= file.text.length &&
        file.text.slice(f.start, f.end).includes(f.excerpt.slice(0, 30)),
    )
    .map((f) => ({
      ...f,
      excerpt: file.text.slice(f.start, f.end).slice(0, 500),
    }));
  const [embedding, prior] = await Promise.all([
    embedTexts([file.text.slice(0, 8000)]).then((v) => v[0]),
    db.query(
      "select a.id,a.embedding from public.assignment_analyses a join public.courses c on c.id=a.course_id where a.course_id=$1 and c.user_id=$2 and a.embedding is not null order by a.created_at desc limit 100",
      [courseId, userId],
    ),
  ]);
  let match: null | { id: string; score: number } = null;
  for (const row of prior.rows) {
    const score = cosine(embedding, row.embedding);
    if (!match || score > match.score) match = { id: row.id, score };
  }
  const disclaimer =
    "AI-writing likelihood is an indicator based on language patterns, not definitive proof. Faculty review and context are required.";
  return (
    await db.query(
      "insert into public.assignment_analyses(course_id,filename,file_type,text_content,content_hash,ai_likelihood,similarity_percent,flags,embedding,matched_analysis_id,disclaimer) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id,course_id,filename,file_type,ai_likelihood,similarity_percent,flags,matched_analysis_id,disclaimer,created_at",
      [
        courseId,
        file.filename,
        file.file_type,
        file.text,
        contentHash,
        ai.ai_likelihood,
        match?.score || 0,
        JSON.stringify(safeFlags),
        embedding,
        match?.id || null,
        disclaimer,
      ],
    )
  ).rows[0];
}

const planItem = z.strictObject({
  kind: z.enum(["quiz", "midterm", "final"]),
  title: z.string().min(2).max(160),
  scheduled_on: z.iso.date(),
  marks: z.number().positive().max(1000),
  weight_percent: z.number().positive().max(100),
  topics: z.array(z.string().min(1).max(300)).min(1).max(50),
  clos: z.array(z.string().min(1).max(300)).max(30),
  rationale: z.string().max(2000),
});
const planResult = z.strictObject({ assessments: z.array(planItem).max(14) });
export async function generatePlan(
  userId: string,
  input: zType.infer<typeof plannerSchema>,
) {
  const [course, syllabusResult, academicSettings] = await Promise.all([
    ownedCourse(userId, input.course_id),
    db.query("select * from public.syllabi where course_id=$1", [input.course_id]),
    getAcademicSettings(),
  ]);
  const syllabus = syllabusResult.rows[0];
  if (!syllabus)
    throw new ApiError(409, "Save a syllabus before generating a plan.");
  const expected =
    input.quiz_count +
    Number(input.include_midterm) +
    Number(input.include_final);
  const result = await generateJson(
    planResult,
    `Create exactly ${expected} assessments: ${input.quiz_count} quizzes, ${input.include_midterm ? 1 : 0} midterms and ${input.include_final ? 1 : 0} finals. Distribute syllabus topics and CLOs based on progress and semester dates. Follow the supplied institutional assessment and academic rules. Return dates inside both the course and institutional semester windows and positive marks/weights whose total weight is at most 100. These are drafts for faculty approval.`,
    { course, syllabus, academic_settings: academicSettings },
  );
  if (result.assessments.length !== expected)
    throw new ApiError(
      422,
      "AI returned an incomplete plan. Please regenerate.",
    );
  const counts = { quiz: 0, midterm: 0, final: 0 };
  let weight = 0;
  for (const item of result.assessments) {
    counts[item.kind]++;
    weight += item.weight_percent;
    const start = [
        calendarDate(course.semester_start),
        calendarDate(academicSettings.semester_start),
      ].sort().at(-1)!,
      end = [
        calendarDate(course.semester_end),
        calendarDate(academicSettings.semester_end),
      ].sort()[0];
    if (end <= start)
      throw new ApiError(409, "Course dates do not overlap the institutional semester.");
    if (item.scheduled_on < start || item.scheduled_on > end)
      throw new ApiError(
        422,
        "AI proposed a date outside the semester. Please regenerate.",
      );
  }
  if (
    counts.quiz !== input.quiz_count ||
    counts.midterm !== Number(input.include_midterm) ||
    counts.final !== Number(input.include_final) ||
    weight > 100.001
  )
    throw new ApiError(
      422,
      "AI returned invalid assessment totals. Please regenerate.",
    );
  return transaction(async (client) => {
    await client.query(
      "delete from public.assessments where course_id=$1 and status='draft' and source='ai'",
      [input.course_id],
    );
    const saved = [];
    for (const item of result.assessments) {
      const row = await client.query(
        "insert into public.assessments(course_id,kind,title,scheduled_on,marks,weight_percent,topics,clos,rationale) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *",
        [
          input.course_id,
          item.kind,
          item.title,
          item.scheduled_on,
          item.marks,
          item.weight_percent,
          JSON.stringify(item.topics),
          JSON.stringify(item.clos),
          item.rationale,
        ],
      );
      saved.push(row.rows[0]);
    }
    return saved;
  });
}
export async function updateAssessment(
  userId: string,
  id: string,
  input: zType.infer<typeof assessmentUpdateSchema>,
) {
  const current = await ownedAssessment(userId, id);
  const course = await ownedCourse(userId, current.course_id);
  if (
    input.scheduled_on &&
    (input.scheduled_on < calendarDate(course.semester_start) ||
      input.scheduled_on > calendarDate(course.semester_end))
  )
    throw new ApiError(400, "Assessment date must be inside the semester.");
  const merged = { ...current, ...input };
  const sum = await db.query(
    "select coalesce(sum(weight_percent),0)::float total from public.assessments where course_id=$1 and id<>$2",
    [current.course_id, id],
  );
  if (Number(sum.rows[0].total) + Number(merged.weight_percent) > 100.001)
    throw new ApiError(
      400,
      "Assessment weights cannot exceed 100% for a course.",
    );
  return (
    await db.query(
      "update public.assessments set title=$1,scheduled_on=$2,marks=$3,weight_percent=$4,topics=$5,clos=$6,status=$7,source='faculty' where id=$8 returning *",
      [
        merged.title,
        merged.scheduled_on,
        merged.marks,
        merged.weight_percent,
        JSON.stringify(merged.topics),
        JSON.stringify(merged.clos),
        merged.status,
        id,
      ],
    )
  ).rows[0];
}

export async function addPreviousPaper(
  userId: string,
  courseId: string,
  year: number,
  file: { filename: string; text: string },
) {
  await ownedCourse(userId, courseId);
  const contentHash = crypto
    .createHash("sha256")
    .update(file.text)
    .digest("hex");
  if (year < 1990 || year > new Date().getFullYear() + 1)
    throw new ApiError(400, "Enter a valid paper year.");
  const texts = (await import("./file-text")).splitQuestions(file.text);
  if (!texts.length)
    throw new ApiError(422, "No questions could be extracted.");
  const embeddings = await embedTexts(texts);
  try {
    return await transaction(async (client) => {
      const paper = (
        await client.query(
          "insert into public.previous_papers(course_id,year,filename,text_content,content_hash) values($1,$2,$3,$4,$5) returning *",
          [courseId, year, file.filename, file.text, contentHash],
        )
      ).rows[0];
      for (let i = 0; i < texts.length; i++)
        await client.query(
          "insert into public.previous_questions(paper_id,question_text,embedding) values($1,$2,$3)",
          [paper.id, texts[i], embeddings[i]],
        );
      return { ...paper, question_count: texts.length };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      throw new ApiError(
        409,
        "That paper or identical content has already been uploaded for this course.",
      );
    throw e;
  }
}
export async function previousMatches(userId: string, courseId: string) {
  await ownedCourse(userId, courseId);
  const rows = (
    await db.query(
      "select q.id,q.question_text,q.embedding,p.year,p.filename from public.previous_questions q join public.previous_papers p on p.id=q.paper_id join public.courses c on c.id=p.course_id where p.course_id=$1 and c.user_id=$2 order by p.year desc",
      [courseId, userId],
    )
  ).rows;
  return rows.map((q, i) => {
    let best: any = null;
    for (let j = 0; j < rows.length; j++) {
      if (i === j || rows[j].year === q.year) continue;
      const score = cosine(q.embedding, rows[j].embedding);
      if (!best || score > best.similarity)
        best = {
          matched_question: rows[j].question_text,
          matched_year: rows[j].year,
          similarity: Number(score.toFixed(1)),
        };
    }
    return {
      id: q.id,
      question: q.question_text,
      year: q.year,
      ...(best || {
        matched_question: null,
        matched_year: null,
        similarity: 0,
      }),
      highly_repeated: (best?.similarity || 0) >= 80,
    };
  });
}

const generatedItem = z.strictObject({
  question_text: z.string().min(5).max(5000),
  clo: z.string().max(300),
  syllabus_relevance: z.number().min(0).max(100),
});
const generatedResult = z.strictObject({
  questions: z.array(generatedItem).min(1).max(20),
});
const relevanceResult = z.strictObject({
  syllabus_relevance: z.number().min(0).max(100),
});
export async function generateQuestions(
  userId: string,
  input: zType.infer<typeof generatorSchema>,
) {
  const course = await ownedCourse(userId, input.course_id);
  if (input.assessment_id) {
    const a = await ownedAssessment(userId, input.assessment_id);
    if (a.course_id !== input.course_id)
      throw new ApiError(400, "Assessment does not belong to this course.");
  }
  const syllabus = (
    await db.query("select * from public.syllabi where course_id=$1", [
      input.course_id,
    ])
  ).rows[0];
  if (!syllabus)
    throw new ApiError(409, "Save a syllabus before generating questions.");
  const previous = (
    await db.query(
      "select q.id,q.question_text,q.embedding,p.year from public.previous_questions q join public.previous_papers p on p.id=q.paper_id where p.course_id=$1 limit 300",
      [input.course_id],
    )
  ).rows;
  const result = await generateJson(
    generatedResult,
    `Generate exactly ${input.count} distinct ${input.difficulty} ${input.assessment_type} questions worth ${input.marks_each} marks each. Use only completed syllabus coverage (progress ${syllabus.progress_percent}%) and the requested CLO. Avoid repeating previous questions. Score syllabus relevance 0-100. Faculty approval is required.`,
    {
      course,
      syllabus,
      requested_clo: input.clo,
      previous_questions: previous.map((v) => ({
        year: v.year,
        text: v.question_text,
      })),
    },
  );
  if (result.questions.length !== input.count)
    throw new ApiError(
      422,
      "AI returned the wrong question count. Please regenerate.",
    );
  const embeddings = await embedTexts(
    result.questions.map((q) => q.question_text),
  );
  return transaction(async (client) => {
    const saved = [];
    for (let i = 0; i < result.questions.length; i++) {
      let match: any = null;
      for (const old of previous) {
        const score = cosine(embeddings[i], old.embedding);
        if (!match || score > match.score) match = { id: old.id, score };
      }
      const q = result.questions[i];
      const row = await client.query(
        "insert into public.generated_questions(course_id,assessment_id,question_text,assessment_type,marks,difficulty,clo,syllabus_relevance,previous_similarity,matched_question_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(course_id,question_text) do nothing returning *",
        [
          input.course_id,
          input.assessment_id || null,
          q.question_text,
          input.assessment_type,
          input.marks_each,
          input.difficulty,
          q.clo || input.clo,
          q.syllabus_relevance,
          match?.score || 0,
          match?.id || null,
        ],
      );
      if (row.rows[0]) saved.push(row.rows[0]);
    }
    if (!saved.length)
      throw new ApiError(
        409,
        "All generated questions duplicate existing records. Regenerate them.",
      );
    return saved;
  });
}
export async function updateQuestion(
  userId: string,
  id: string,
  input: zType.infer<typeof questionUpdateSchema>,
) {
  const found = await db.query(
    "select g.* from public.generated_questions g join public.courses c on c.id=g.course_id where g.id=$1 and c.user_id=$2",
    [id, userId],
  );
  if (!found.rows[0]) throw new ApiError(404, "Question not found.");
  const merged = { ...found.rows[0], ...input };
  if (
    input.question_text &&
    input.question_text !== found.rows[0].question_text
  ) {
    const [syllabus, previous, embedding, relevance] = await Promise.all([
      db.query(
        "select content,topics,clos,progress_percent from public.syllabi where course_id=$1",
        [merged.course_id],
      ),
      db.query(
        "select q.id,q.embedding from public.previous_questions q join public.previous_papers p on p.id=q.paper_id where p.course_id=$1 and q.embedding is not null limit 300",
        [merged.course_id],
      ),
      embedTexts([merged.question_text]).then((values) => values[0]),
      db
        .query(
          "select content,topics,clos,progress_percent from public.syllabi where course_id=$1",
          [merged.course_id],
        )
        .then(async (result) => {
          if (!result.rows[0])
            throw new ApiError(409, "The course syllabus is missing.");
          return generateJson(
            relevanceResult,
            "Score how relevant this faculty-edited question is to the supplied syllabus and completed coverage from 0 to 100.",
            { syllabus: result.rows[0], question: merged.question_text },
          );
        }),
    ]);
    if (!syllabus.rows[0])
      throw new ApiError(409, "The course syllabus is missing.");
    let match: { id: string; score: number } | null = null;
    for (const old of previous.rows) {
      const score = cosine(embedding, old.embedding);
      if (!match || score > match.score) match = { id: old.id, score };
    }
    merged.syllabus_relevance = relevance.syllabus_relevance;
    merged.previous_similarity = match?.score || 0;
    merged.matched_question_id = match?.id || null;
    merged.status = "draft";
  }
  try {
    return (
      await db.query(
        "update public.generated_questions set question_text=$1,marks=$2,difficulty=$3,clo=$4,status=$5,syllabus_relevance=$6,previous_similarity=$7,matched_question_id=$8 where id=$9 returning *",
        [
          merged.question_text,
          merged.marks,
          merged.difficulty,
          merged.clo,
          merged.status,
          merged.syllabus_relevance,
          merged.previous_similarity,
          merged.matched_question_id,
          id,
        ],
      )
    ).rows[0];
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      throw new ApiError(409, "That question already exists.");
    throw e;
  }
}
export async function deleteQuestion(userId: string, id: string) {
  const result = await db.query(
    "delete from public.generated_questions g using public.courses c where g.id=$1 and g.course_id=c.id and c.user_id=$2 returning g.id",
    [id, userId],
  );
  if (!result.rows[0]) throw new ApiError(404, "Question not found.");
}

export async function refreshNotifications(userId: string) {
  const data = await facultyWorkspace(userId);
  const now = new Date();
  const items: any[] = [];
  for (const assessment of data.assessments.filter(
    (a: any) => a.status === "approved",
  )) {
    const course = data.courses.find((c: any) => c.id === assessment.course_id);
    const syllabus = data.syllabi.find((s: any) => s.course_id === course.id);
    const days = Math.ceil(
      (new Date(assessment.scheduled_on).valueOf() - now.valueOf()) / 86400000,
    );
    if (days >= 0 && days <= 14)
      items.push({
        course,
        assessment,
        kind: "countdown",
        severity: days <= 3 ? "urgent" : "info",
        title: `${assessment.title} in ${days} day${days === 1 ? "" : "s"}`,
        message: `${course.code} · ${assessment.scheduled_on}`,
      });
    if ((syllabus?.progress_percent || 0) < 60 && days >= 0 && days <= 14)
      items.push({
        course,
        assessment,
        kind: "readiness",
        severity: "warning",
        title: `${course.code} readiness is low`,
        message: `Only ${syllabus?.progress_percent || 0}% of the syllabus is marked complete before ${assessment.title}.`,
      });
    const topics = assessment.topics || [];
    const covered = Math.ceil(
      topics.length * (Number(syllabus?.progress_percent || 0) / 100),
    );
    if (covered < topics.length && days >= 0)
      items.push({
        course,
        assessment,
        kind: "coverage",
        severity: "warning",
        title: `${topics.length - covered} topics may be incomplete`,
        message: `Review coverage for ${assessment.title}.`,
      });
    const conflict = data.assessments.find(
      (a: any) =>
        a.id !== assessment.id &&
        a.status === "approved" &&
        calendarDate(a.scheduled_on) === calendarDate(assessment.scheduled_on),
    );
    if (conflict)
      items.push({
        course,
        assessment,
        kind: "conflict",
        severity: "urgent",
        title: "Assessment date conflict",
        message: `${assessment.title} overlaps another approved assessment.`,
      });
  }
  for (const item of items) {
    const fingerprint = `${item.kind}:${item.assessment.id}:${item.message}`;
    await db.query(
      "insert into public.notifications(user_id,course_id,assessment_id,kind,title,message,severity,fingerprint) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(user_id,fingerprint) do update set title=excluded.title,message=excluded.message,severity=excluded.severity",
      [
        userId,
        item.course.id,
        item.assessment.id,
        item.kind,
        item.title,
        item.message,
        item.severity,
        fingerprint,
      ],
    );
  }
  return (
    await db.query(
      "select * from public.notifications where user_id=$1 order by is_read,created_at desc",
      [userId],
    )
  ).rows;
}
export async function readNotification(
  userId: string,
  id: string,
  isRead: boolean,
) {
  const row = (
    await db.query(
      "update public.notifications set is_read=$1 where id=$2 and user_id=$3 returning *",
      [isRead, id, userId],
    )
  ).rows[0];
  if (!row) throw new ApiError(404, "Notification not found.");
  return row;
}

const roadmapItem = z.strictObject({
  course_code: z.string().min(2).max(30),
  assessment_title: z.string().min(2).max(160),
  recommended_on: z.iso.date(),
  rationale: z.string().max(2000),
});
const roadmapResult = z.strictObject({ items: z.array(roadmapItem).max(100) });
export async function generateRoadmap(
  userId: string,
  input: zType.infer<typeof roadmapSchema>,
) {
  const [data, academicSettings] = await Promise.all([
    facultyWorkspace(userId),
    getAcademicSettings(),
  ]);
  if (!data.courses.length)
    throw new ApiError(409, "Add a course before generating a roadmap.");
  const end = new Date(Date.now() + input.horizon_days * 86400000)
    .toISOString()
    .slice(0, 10);
  const candidates = data.assessments.filter(
    (a: any) => a.status === "draft" && calendarDate(a.scheduled_on) <= end,
  );
  if (!candidates.length)
    throw new ApiError(
      409,
      "Create draft assessment plans before generating a roadmap.",
    );
  const ai = await generateJson(
    roadmapResult,
    "Recommend a date for every supplied draft assessment. Balance all courses, class routines, syllabus progress and approved assessments. Follow the supplied institutional assessment and academic rules. Dates must be within both the course and institutional semester windows and the requested horizon. Avoid same-day assessment conflicts. Explain each recommendation. Return course codes and assessment titles exactly as supplied; they are labels, not trusted IDs.",
    {
      horizon_end: end,
      academic_settings: academicSettings,
      courses: data.courses,
      syllabi: data.syllabi.map((s: any) => ({
        course_id: s.course_id,
        progress_percent: s.progress_percent,
        topics: s.topics,
      })),
      routines: data.routines,
      approved: data.assessments.filter((a: any) => a.status === "approved"),
      drafts: candidates.map((a: any) => ({
        course_code: data.courses.find((c: any) => c.id === a.course_id)?.code,
        assessment_title: a.title,
        current_date: a.scheduled_on,
        kind: a.kind,
      })),
    },
  );
  if (ai.items.length !== candidates.length)
    throw new ApiError(
      422,
      "AI returned an incomplete roadmap. Please recalculate.",
    );
  return transaction(async (client) => {
    const run = (
      await client.query(
        "insert into public.roadmap_runs(user_id) values($1) returning *",
        [userId],
      )
    ).rows[0];
    const saved = [];
    for (const item of ai.items) {
      const course = data.courses.find((c: any) => c.code === item.course_code);
      const assessment = candidates.find(
        (a: any) =>
          a.course_id === course?.id && a.title === item.assessment_title,
      );
      if (!course || !assessment)
        throw new ApiError(422, "AI returned an unknown course or assessment.");
      const start = [
          calendarDate(course.semester_start),
          calendarDate(academicSettings.semester_start),
        ].sort().at(-1)!,
        finish = [
          calendarDate(course.semester_end),
          calendarDate(academicSettings.semester_end),
        ].sort()[0];
      if (
        item.recommended_on < start ||
        item.recommended_on > finish ||
        item.recommended_on > end
      )
        throw new ApiError(422, "AI proposed an invalid roadmap date.");
      const conflicts = data.assessments
        .filter(
          (a: any) =>
            a.id !== assessment.id &&
            calendarDate(a.scheduled_on) === item.recommended_on,
        )
        .map((a: any) => a.title);
      const score = Math.max(
        0,
        100 -
          conflicts.length * 35 -
          Math.max(
            0,
            60 -
              Number(
                data.syllabi.find((s: any) => s.course_id === course.id)
                  ?.progress_percent || 0,
              ),
          ) *
            0.25,
      );
      const row = await client.query(
        "insert into public.roadmap_items(run_id,course_id,assessment_id,recommended_on,score,conflicts,rationale) values($1,$2,$3,$4,$5,$6,$7) returning *",
        [
          run.id,
          course.id,
          assessment.id,
          item.recommended_on,
          score,
          JSON.stringify(conflicts),
          item.rationale,
        ],
      );
      saved.push({
        ...row.rows[0],
        code: course.code,
        title: course.title,
        assessment_title: assessment.title,
      });
    }
    return saved;
  });
}
