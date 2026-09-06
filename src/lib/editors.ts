import "server-only";
import { transaction } from "./db";
import { ApiError } from "./api-error";
import { assessmentFormSchema, questionSetSchema } from "./editor-validation";
import type { z } from "zod";

export async function saveAssessment(
  userId: string,
  input: z.infer<typeof assessmentFormSchema>,
) {
  return transaction(async (client) => {
    const course = (
      await client.query(
        "select * from public.courses where id=$1 and user_id=$2 for update",
        [input.course_id, userId],
      )
    ).rows[0];
    if (!course) throw new ApiError(404, "Course not found.");
    if (
      input.id &&
      !(
        await client.query(
          "select id from public.assessments where id=$1 and course_id=$2",
          [input.id, input.course_id],
        )
      ).rowCount
    )
      throw new ApiError(404, "Assessment not found.");
    const day = (v: Date | string) =>
      v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
    if (
      input.scheduled_on < day(course.semester_start) ||
      input.scheduled_on > day(course.semester_end)
    )
      throw new ApiError(
        400,
        "Assessment date must be inside the course semester.",
      );
    const total = (
      await client.query(
        "select coalesce(sum(weight_percent),0)::float total from public.assessments where course_id=$1 and ($2::uuid is null or id<>$2)",
        [input.course_id, input.id || null],
      )
    ).rows[0].total;
    if (total + input.weight_percent > 100.001)
      throw new ApiError(
        400,
        "Assessment weights cannot exceed 100% for a course.",
      );
    const values = [
      input.course_id,
      input.title,
      input.kind,
      input.scheduled_on,
      input.marks,
      input.weight_percent,
      JSON.stringify(input.topics),
      JSON.stringify(input.clos),
      input.status,
    ];
    try {
      return (
        await client.query(
          input.id
            ? "update public.assessments set title=$2,kind=$3,scheduled_on=$4,marks=$5,weight_percent=$6,topics=$7,clos=$8,status=$9,source='faculty' where course_id=$1 and id=$10 returning *"
            : "insert into public.assessments(course_id,title,kind,scheduled_on,marks,weight_percent,topics,clos,status,source) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'faculty') returning *",
          input.id ? [...values, input.id] : values,
        )
      ).rows[0];
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new ApiError(409, "This assessment already exists.");
      throw e;
    }
  });
}
export async function saveQuestions(
  userId: string,
  input: z.infer<typeof questionSetSchema>,
) {
  return transaction(async (client) => {
    if (
      !(
        await client.query(
          "select id from public.courses where id=$1 and user_id=$2 for update",
          [input.course_id, userId],
        )
      ).rowCount
    )
      throw new ApiError(404, "Course not found.");
    const existing = (
      await client.query(
        "select * from public.generated_questions where course_id=$1 for update",
        [input.course_id],
      )
    ).rows;
    if (input.original_ids.some((id) => !existing.some((q) => q.id === id)))
      throw new ApiError(
        409,
        "Questions changed. Cancel and reopen the editor.",
      );
    for (const q of input.questions) {
      if (
        q.assessment_id &&
        !(
          await client.query(
            "select id from public.assessments where id=$1 and course_id=$2",
            [q.assessment_id, input.course_id],
          )
        ).rowCount
      )
        throw new ApiError(404, "Assessment not found.");
    }
    const retained = input.questions.flatMap((q) => (q.id ? [q.id] : []));
    await client.query(
      "delete from public.generated_questions where course_id=$1 and id=any($2::uuid[]) and not(id=any($3::uuid[]))",
      [input.course_id, input.original_ids, retained],
    );
    // Temporary unique text allows exchanging question text within one atomic save.
    for (const q of input.questions.filter((q) => q.id))
      await client.query(
        "update public.generated_questions set question_text=$1 where id=$2",
        ["Editing question " + q.id, q.id],
      );
    for (const [position, q] of input.questions.entries()) {
      const old = existing.find((row) => row.id === q.id);
      const changed =
        !old ||
        [
          "question_text",
          "assessment_type",
          "difficulty",
          "clo",
          "question_type",
          "answer",
        ].some((k) => String(old[k]) !== String(q[k as keyof typeof q])) ||
        Number(old.marks) !== q.marks ||
        old.assessment_id !== q.assessment_id ||
        JSON.stringify(old.options) !== JSON.stringify(q.options);
      const params = [
        input.course_id,
        q.assessment_id,
        q.question_text,
        q.assessment_type,
        q.marks,
        q.difficulty,
        q.clo,
        q.question_type,
        JSON.stringify(q.options),
        q.answer,
        position,
        changed || old?.quality_pending || false,
        changed ? "draft" : old.status,
      ];
      if (q.id)
        await client.query(
          "update public.generated_questions set assessment_id=$2,question_text=$3,assessment_type=$4,marks=$5,difficulty=$6,clo=$7,question_type=$8,options=$9,answer=$10,position=$11,quality_pending=$12,status=$13,syllabus_relevance=case when $12 then 0 else syllabus_relevance end,previous_similarity=case when $12 then 0 else previous_similarity end,matched_question_id=case when $12 then null else matched_question_id end where course_id=$1 and id=$14",
          [...params, q.id],
        );
      else
        await client.query(
          "insert into public.generated_questions(course_id,assessment_id,question_text,assessment_type,marks,difficulty,clo,question_type,options,answer,position,quality_pending,status,syllabus_relevance,previous_similarity) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,0)",
          params,
        );
    }
    return { saved: true };
  });
}
