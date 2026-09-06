import fs from "node:fs";
import bcrypt from "bcryptjs";
import pg from "pg";
if (!process.argv.includes("--confirm-demo"))
  throw new Error("Use --confirm-demo with a dedicated demo account.");
const { DEMO_EMAIL, DEMO_PASSWORD, DATABASE_URL } = process.env;
if (!DEMO_EMAIL || !DEMO_PASSWORD || !DATABASE_URL)
  throw new Error("Set DEMO_EMAIL, DEMO_PASSWORD, and DATABASE_URL locally.");
const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(
      process.env.SUPABASE_DB_CA_PATH ||
        "certificates/supabase-prod-ca-2021.crt",
      "utf8",
    ),
  },
});
try {
  await client.connect();
  await client.query("begin");
  let account = await client.query(
    "select id from public.faculty_accounts where email=$1",
    [DEMO_EMAIL.toLowerCase()],
  );
  if (!account.rows[0])
    account = await client.query(
      "insert into public.faculty_accounts(email,password_hash,display_name) values($1,$2,'Demo Faculty') returning id",
      [DEMO_EMAIL.toLowerCase(), await bcrypt.hash(DEMO_PASSWORD, 12)],
    );
  const userId = account.rows[0].id;
  const existing = await client.query(
    "select count(*)::int count from public.tasks where user_id=$1",
    [userId],
  );
  if (existing.rows[0].count)
    throw new Error(
      "Demo seeding requires an empty account; existing tasks are preserved.",
    );
  const now = Date.now(),
    day = 86400000;
  const entries = [
    ["Grade midterm scripts", "CSE101", "Grading", "urgent", -2, "pending"],
    [
      "Prepare next lecture slides",
      "CSE101",
      "Teaching",
      "high",
      0.2,
      "in_progress",
    ],
    ["Review thesis proposal", "CSE499", "Advising", "high", 2, "pending"],
    [
      "Publish weekly lab assignment",
      "CSE220",
      "Teaching",
      "medium",
      4,
      "pending",
    ],
    ["Outline research paper", "", "Research", "medium", null, "pending"],
    [
      "Prepare department meeting agenda",
      "",
      "Administration",
      "low",
      6,
      "pending",
    ],
    [
      "Submit semester course outline",
      "CSE101",
      "Teaching",
      "high",
      -4,
      "completed",
    ],
    [
      "Review lab equipment request",
      "",
      "Administration",
      "low",
      -3,
      "completed",
    ],
  ];
  for (const [title, course, category, priority, days, status] of entries)
    await client.query(
      "insert into public.tasks(user_id,title,course_code,category,priority,status,description,due_at) values($1,$2,$3,$4,$5,$6,'Fictional faculty demo task.',$7)",
      [
        userId,
        title,
        course,
        category,
        priority,
        status,
        days === null ? null : new Date(now + Number(days) * day),
      ],
    );
  await client.query("commit");
  console.log("Created the demo account and 8 tasks.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
