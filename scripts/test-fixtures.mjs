import fs from "node:fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";
import { lookup } from "node:dns/promises";
export async function testDatabase() {
  try {
    process.loadEnvFile(".env.local");
  } catch {}
  if (!process.env.DATABASE_URL)
    throw new Error("Live database tests require DATABASE_URL.");
  const url = new URL(process.env.DATABASE_URL),
    servername = url.hostname;
  url.hostname = (await lookup(servername, { family: 4 })).address;
  const client = new pg.Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 15000,
    ssl: {
      servername,
      rejectUnauthorized: true,
      ca: fs.readFileSync(
        process.env.SUPABASE_DB_CA_PATH ||
          "certificates/supabase-prod-ca-2021.crt",
        "utf8",
      ),
    },
  });
  await client.connect();
  return client;
}
export function testUser() {
  const id = crypto.randomUUID();
  return {
    email: "facultyflow-test-" + id + "@example.com",
    password: crypto.randomBytes(18).toString("base64url"),
    display_name: "Dr. Alex Morgan",
  };
}
export async function createTestUser(client, user = testUser()) {
  const hash = await bcrypt.hash(user.password, 4);
  const result = await client.query(
    "insert into public.faculty_accounts(email,password_hash,display_name) values($1,$2,$3) returning id",
    [user.email, hash, user.display_name],
  );
  return { ...user, id: result.rows[0].id };
}
export async function removeTestUsers(client, users) {
  for (const user of users)
    await client.query("delete from public.faculty_accounts where email=$1", [
      user.email,
    ]);
}
