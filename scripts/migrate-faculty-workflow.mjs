import fs from "node:fs";
import pg from "pg";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
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
    "select to_regclass('public.courses') as courses",
  );
  if (existing.rows[0].courses)
    console.log("Faculty workflow schema is already installed.");
  else {
    await client.query(
      fs.readFileSync(
        "supabase/migrations/202609060003_faculty_workflow.sql",
        "utf8",
      ),
    );
    console.log("Faculty workflow schema installed.");
  }
  const hardening = await client.query(
    "select 1 from information_schema.columns where table_schema='public' and table_name='assignment_analyses' and column_name='content_hash'",
  );
  if (!hardening.rowCount) {
    await client.query(
      fs.readFileSync(
        "supabase/migrations/202609060004_faculty_workflow_hardening.sql",
        "utf8",
      ),
    );
    console.log("Faculty workflow upload constraints installed.");
  }
  const actions = await client.query(
    "select to_regclass('public.assistant_actions') as actions",
  );
  if (!actions.rows[0].actions) {
    await client.query(
      fs.readFileSync(
        "supabase/migrations/202609060005_assistant_actions.sql",
        "utf8",
      ),
    );
    console.log("Assistant action approvals installed.");
  }
  const roles = await client.query(
    "select 1 from information_schema.columns where table_schema='public' and table_name='faculty_accounts' and column_name='role'",
  );
  const settings = await client.query(
    "select to_regclass('public.academic_settings') as settings",
  );
  if (!roles.rowCount || !settings.rows[0].settings) {
    await client.query(
      fs.readFileSync(
        "supabase/migrations/202609060006_admin_roles_settings.sql",
        "utf8",
      ),
    );
    console.log("Admin roles and academic settings installed.");
  }
  await client.query(
    "create table if not exists public.faculty_setup_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const separateAdmin = "202609060007_separate_admin.sql";
  const applied = await client.query(
    "select 1 from public.faculty_setup_migrations where name=$1",
    [separateAdmin],
  );
  if (!applied.rowCount) {
    await client.query(
      fs.readFileSync(`supabase/migrations/${separateAdmin}`, "utf8"),
    );
    await client.query(
      "insert into public.faculty_setup_migrations(name) values($1)",
      [separateAdmin],
    );
    console.log("Separate administrator account installed; Tarin is faculty.");
  }
  const editorMigration = "202609060008_question_editor.sql";
  if (
    !(
      await client.query(
        "select 1 from public.faculty_setup_migrations where name=$1",
        [editorMigration],
      )
    ).rowCount
  ) {
    await client.query(
      fs.readFileSync(`supabase/migrations/${editorMigration}`, "utf8"),
    );
    await client.query(
      "insert into public.faculty_setup_migrations(name) values($1)",
      [editorMigration],
    );
    console.log("Question editor fields installed.");
  }
  const chatMigration = "202609060009_chat_history.sql";
  if (
    !(
      await client.query(
        "select 1 from public.faculty_setup_migrations where name=$1",
        [chatMigration],
      )
    ).rowCount
  ) {
    await client.query(
      fs.readFileSync(`supabase/migrations/${chatMigration}`, "utf8"),
    );
    await client.query(
      "insert into public.faculty_setup_migrations(name) values($1)",
      [chatMigration],
    );
    console.log("Persistent chat history installed.");
  }
} finally {
  await client.end();
}
