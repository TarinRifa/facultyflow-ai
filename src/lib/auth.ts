import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db, transaction } from "@/lib/db";
import { ApiError } from "@/lib/api-error";

export const SESSION_COOKIE = "facultyflow_session";
const SESSION_DAYS = 7;

export interface FacultyUser {
  id: string;
  email: string;
  display_name: string;
  timezone: string;
}

function digest(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function setSession(accountId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await transaction(async (client) => {
    await client.query(
      "delete from public.faculty_sessions where expires_at <= now() or account_id = $1",
      [accountId],
    );
    await client.query(
      "insert into public.faculty_sessions(account_id, token_hash, expires_at) values($1,$2,$3)",
      [accountId, digest(token), expires],
    );
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function register(
  displayName: string,
  email: string,
  password: string,
) {
  const normalized = email.trim().toLowerCase();
  const hash = await bcrypt.hash(password, 12);
  try {
    const result = await db.query<FacultyUser>(
      "insert into public.faculty_accounts(display_name,email,password_hash) values($1,$2,$3) returning id,email,display_name,timezone",
      [displayName.trim(), normalized, hash],
    );
    await setSession(result.rows[0].id);
    return result.rows[0];
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new ApiError(409, "An account already exists for this email.");
    throw error;
  }
}

export async function login(email: string, password: string) {
  const result = await db.query<FacultyUser & { password_hash: string }>(
    "select id,email,display_name,timezone,password_hash from public.faculty_accounts where email=$1",
    [email.trim().toLowerCase()],
  );
  const account = result.rows[0];
  if (!account || !(await bcrypt.compare(password, account.password_hash)))
    throw new ApiError(401, "Email or password is incorrect.");
  await setSession(account.id);
  const { password_hash: _passwordHash, ...user } = account;
  void _passwordHash;
  return user;
}

export async function currentUser(): Promise<FacultyUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await db.query<FacultyUser>(
    `select a.id,a.email,a.display_name,a.timezone from public.faculty_sessions s join public.faculty_accounts a on a.id=s.account_id where s.token_hash=$1 and s.expires_at>now()`,
    [digest(token)],
  );
  return result.rows[0] || null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "Please sign in to continue.");
  return user;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token)
    await db.query("delete from public.faculty_sessions where token_hash=$1", [
      digest(token),
    ]);
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
