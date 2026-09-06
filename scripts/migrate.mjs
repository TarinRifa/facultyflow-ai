import fs from "node:fs";
import pg from "pg";
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL for the current Supabase project in .env.local, or run the migration in Supabase SQL Editor.");
const url = new URL(process.env.DATABASE_URL);
if (!url.username.includes(process.env.SUPABASE_PROJECT_REF || "INVALID") && !url.hostname.includes(process.env.SUPABASE_PROJECT_REF || "INVALID")) throw new Error("Connection must match SUPABASE_PROJECT_REF.");
const client = new pg.Client({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:true,...(process.env.SUPABASE_DB_CA_PATH ? {ca:fs.readFileSync(process.env.SUPABASE_DB_CA_PATH,"utf8")}: {})}});
try {
 await client.connect();
 const existing = await client.query("select to_regclass('public.tasks') as tasks");
 if(existing.rows[0].tasks) throw new Error("Tasks table already exists. Review migration history before applying.");
 await client.query(fs.readFileSync("supabase/migrations/202609060001_facultyflow.sql","utf8"));
 console.log("FacultyFlow schema and RLS installed.");
} finally { await client.end(); }
