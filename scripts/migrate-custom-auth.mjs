import fs from "node:fs";
import pg from "pg";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const url = new URL(process.env.DATABASE_URL);
if (!url.username.includes(process.env.SUPABASE_PROJECT_REF || "INVALID"))
  throw new Error("Connection must match SUPABASE_PROJECT_REF.");
const ca = fs.readFileSync(
  process.env.SUPABASE_DB_CA_PATH || "certificates/supabase-prod-ca-2021.crt",
  "utf8",
);
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true, ca },
});
try {
  await client.connect();
  const existing = await client.query(
    "select to_regclass('public.faculty_accounts') as accounts",
  );
  if (existing.rows[0].accounts) {
    console.log("Custom authentication schema is already installed.");
    process.exit(0);
  }
  const taskCount = await client.query(
    "select count(*)::int as count from public.tasks",
  );
  if (taskCount.rows[0].count !== 0)
    throw new Error(
      "Task ownership migration requires an explicit account mapping; no data was changed.",
    );
  await client.query(
    fs.readFileSync("supabase/migrations/202609060002_custom_auth.sql", "utf8"),
  );
  console.log("Custom faculty accounts and sessions installed.");
} finally {
  await client.end();
}
