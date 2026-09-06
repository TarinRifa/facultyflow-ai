import fs from "node:fs";
import pg from "pg";
const email = (process.env.SEED_FACULTY_EMAIL || "tarinrifa@gmail.com")
  .trim()
  .toLowerCase();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const ca = fs.readFileSync(
  process.env.SUPABASE_DB_CA_PATH || "certificates/supabase-prod-ca-2021.crt",
  "utf8",
);
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true, ca },
});
const courses = [
  {
    code: "EDU301",
    title: "Curriculum Design and Academic Quality",
    start: "2026-08-15",
    end: "2026-12-20",
    progress: 48,
    topics: [
      "Curriculum foundations",
      "Learning outcomes",
      "Constructive alignment",
      "Assessment blueprint",
      "Program review",
      "Academic quality assurance",
    ],
    clos: [
      "Design an aligned curriculum",
      "Evaluate assessment quality",
      "Apply quality assurance frameworks",
    ],
  },
  {
    code: "CSE401",
    title: "Course Management and Assessment",
    start: "2026-08-15",
    end: "2026-12-20",
    progress: 62,
    topics: [
      "Course planning",
      "Learning management systems",
      "Formative assessment",
      "Rubric design",
      "Feedback strategies",
      "Learning analytics",
    ],
    clos: [
      "Plan and manage a university course",
      "Design valid assessments",
      "Interpret learning analytics",
    ],
  },
  {
    code: "RES501",
    title: "Research Methods for Faculty",
    start: "2026-08-15",
    end: "2026-12-20",
    progress: 35,
    topics: [
      "Research questions",
      "Literature review",
      "Study design",
      "Data collection",
      "Research ethics",
      "Academic writing",
    ],
    clos: [
      "Formulate research questions",
      "Select appropriate methods",
      "Evaluate research ethics",
    ],
  },
];
const tasks = [
  [
    "Revise curriculum design map",
    "Align program outcomes with course CLOs",
    5,
    "high",
    "Curriculum Design",
    "EDU301",
  ],
  [
    "Prepare assessment moderation pack",
    "Collect quiz rubrics and sample scripts",
    2,
    "urgent",
    "Assessment",
    "CSE401",
  ],
  [
    "Complete grading for Quiz 1",
    "Publish feedback after moderation",
    1,
    "urgent",
    "Grading",
    "CSE401",
  ],
  [
    "Update course management checklist",
    "Review attendance and LMS participation",
    4,
    "medium",
    "Course Management",
    "CSE401",
  ],
  [
    "Review academic quality indicators",
    "Prepare evidence for program review",
    8,
    "high",
    "Academic Quality",
    "EDU301",
  ],
  [
    "Draft research ethics application",
    "Complete participant information sheet",
    10,
    "high",
    "Research",
    "RES501",
  ],
  [
    "Plan next week’s courses",
    "Confirm readings and learning activities",
    3,
    "medium",
    "Courses",
    "",
  ],
  [
    "Build quiz question bank",
    "Add CLO tags and difficulty levels",
    6,
    "high",
    "Quizzes",
    "CSE401",
  ],
];
await client.connect();
try {
  await client.query("begin");
  const account = (
    await client.query(
      "select id from public.faculty_accounts where email=$1",
      [email],
    )
  ).rows[0];
  if (!account) throw new Error(`No faculty account exists for ${email}.`);
  const ids = new Map();
  for (const c of courses) {
    const row = (
      await client.query(
        "insert into public.courses(user_id,code,title,semester_start,semester_end) values($1,$2,$3,$4,$5) on conflict(user_id,code) do update set title=excluded.title,semester_start=excluded.semester_start,semester_end=excluded.semester_end returning id",
        [account.id, c.code, c.title, c.start, c.end],
      )
    ).rows[0];
    ids.set(c.code, row.id);
    await client.query(
      "insert into public.syllabi(course_id,content,source_name,clos,topics,progress_percent) values($1,$2,'Seeded faculty curriculum',$3,$4,$5) on conflict(course_id) do update set content=excluded.content,clos=excluded.clos,topics=excluded.topics,progress_percent=excluded.progress_percent",
      [
        row.id,
        `${c.title}. ${c.topics.join(". ")}.`,
        JSON.stringify(c.clos),
        JSON.stringify(c.topics),
        c.progress,
      ],
    );
  }
  for (const [title, description, days, priority, category, code] of tasks)
    await client.query(
      "insert into public.tasks(user_id,title,description,due_at,priority,category,course_code,status) select $1,$2,$3,now()+($4||' days')::interval,$5,$6,$7,'pending' where not exists(select 1 from public.tasks where user_id=$1 and title=$2)",
      [account.id, title, description, String(days), priority, category, code],
    );
  const quizzes = [
    [
      "EDU301",
      "Curriculum Alignment Quiz",
      "2026-09-18",
      15,
      10,
      ["Curriculum foundations", "Learning outcomes"],
    ],
    [
      "CSE401",
      "Assessment Design Quiz",
      "2026-09-22",
      20,
      10,
      ["Formative assessment", "Rubric design"],
    ],
    [
      "RES501",
      "Research Questions Quiz",
      "2026-09-28",
      15,
      10,
      ["Research questions", "Literature review"],
    ],
  ];
  for (const [code, title, date, marks, weight, topics] of quizzes)
    await client.query(
      "insert into public.assessments(course_id,kind,title,scheduled_on,marks,weight_percent,topics,clos,rationale,status,source) values($1,'quiz',$2,$3,$4,$5,$6,'[]','Seeded quiz for the connected faculty demo.','approved','faculty') on conflict(course_id,kind,title,scheduled_on) do nothing",
      [ids.get(code), title, date, marks, weight, JSON.stringify(topics)],
    );
  const counts = await client.query(
    "select (select count(*)::int from public.courses where user_id=$1 and code=any($2::text[])) courses,(select count(*)::int from public.tasks where user_id=$1 and category=any($3::text[])) seeded_tasks,(select count(*)::int from public.assessments a join public.courses c on c.id=a.course_id where c.user_id=$1 and a.kind='quiz' and a.title=any($4::text[])) quizzes",
    [
      account.id,
      courses.map((course) => course.code),
      tasks.map((task) => task[4]),
      quizzes.map((quiz) => quiz[1]),
    ],
  );
  await client.query("commit");
  console.log(
    `Faculty seed ready for ${email}: ${JSON.stringify(counts.rows[0])}`,
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
