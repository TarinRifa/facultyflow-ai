import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import type { z } from "zod";
import type { academicSettingsSchema } from "@/lib/admin-validation";
import type { createAdminSchema } from "@/lib/admin-validation";
import bcrypt from "bcryptjs";

export async function listAccounts() {
  return (
    await db.query(
      "select id,email,display_name,timezone,role,created_at from public.faculty_accounts order by created_at asc",
    )
  ).rows;
}

export async function makeAdmin(userId: string) {
  const result = await db.query(
    "update public.faculty_accounts set role='admin',updated_at=now() where id=$1 returning id,email,display_name,timezone,role,created_at",
    [userId],
  );
  if (!result.rows[0]) throw new ApiError(404, "User account not found.");
  return result.rows[0];
}

export async function createAdmin(input: z.infer<typeof createAdminSchema>) {
  try {
    return (
      await db.query(
        "insert into public.faculty_accounts(display_name,email,password_hash,role) values($1,$2,$3,'admin') returning id,email,display_name,timezone,role,created_at",
        [input.display_name, input.email, await bcrypt.hash(input.password, 12)],
      )
    ).rows[0];
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new ApiError(409, "An account already exists for this email.");
    throw error;
  }
}

export async function getAcademicSettings() {
  const result = await db.query(
    "select semester_start,semester_end,assessment_rules,academic_rules,updated_at from public.academic_settings where id=true",
  );
  if (!result.rows[0])
    throw new ApiError(503, "Academic settings have not been initialized.");
  return result.rows[0];
}

export async function saveAcademicSettings(
  adminId: string,
  input: z.infer<typeof academicSettingsSchema>,
) {
  return (
    await db.query(
      `insert into public.academic_settings(id,semester_start,semester_end,assessment_rules,academic_rules,updated_by,updated_at)
       values(true,$1,$2,$3,$4,$5,now())
       on conflict(id) do update set semester_start=excluded.semester_start,semester_end=excluded.semester_end,
       assessment_rules=excluded.assessment_rules,academic_rules=excluded.academic_rules,updated_by=excluded.updated_by,updated_at=now()
       returning semester_start,semester_end,assessment_rules,academic_rules,updated_at`,
      [
        input.semester_start,
        input.semester_end,
        input.assessment_rules,
        input.academic_rules,
        adminId,
      ],
    )
  ).rows[0];
}
