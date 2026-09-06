import { z } from "zod";

export const promoteUserSchema = z.strictObject({
  user_id: z.uuid(),
});

export const createAdminSchema = z.strictObject({
  display_name: z.string().trim().min(2).max(100),
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
});

export const academicSettingsSchema = z
  .strictObject({
    semester_start: z.iso.date(),
    semester_end: z.iso.date(),
    assessment_rules: z.string().trim().max(10000),
    academic_rules: z.string().trim().max(10000),
  })
  .refine(
    (value) => value.semester_end > value.semester_start,
    "Semester end must be after its start.",
  );
