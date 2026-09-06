import { z } from "zod";

const id = z.uuid();
const date = z.iso.date();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const courseSchema = z
  .strictObject({
    code: text(2, 30).transform((v) => v.toUpperCase()),
    title: text(2, 160),
    semester_start: date,
    semester_end: date,
  })
  .refine(
    (v) => v.semester_end > v.semester_start,
    "Semester end must be after its start.",
  );
export const syllabusSchema = z.strictObject({
  course_id: id,
  content: text(20, 100000),
  source_name: z.string().trim().max(255).default("Manual entry"),
  clos: z.array(text(1, 300)).max(30),
  topics: z.array(text(1, 300)).max(200),
  progress_percent: z.number().min(0).max(100),
});
export const routineSchema = z
  .strictObject({
    course_id: id,
    weekday: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    room: z.string().trim().max(80).default(""),
  })
  .refine(
    (v) => v.end_time > v.start_time,
    "Class end time must be after its start.",
  );
export const plannerSchema = z
  .strictObject({
    course_id: id,
    quiz_count: z.number().int().min(0).max(12),
    include_midterm: z.boolean(),
    include_final: z.boolean(),
  })
  .refine(
    (v) =>
      v.quiz_count + Number(v.include_midterm) + Number(v.include_final) > 0,
    "Select at least one assessment.",
  );
export const assessmentUpdateSchema = z
  .strictObject({
    title: text(2, 160).optional(),
    scheduled_on: date.optional(),
    marks: z.number().positive().max(1000).optional(),
    weight_percent: z.number().positive().max(100).optional(),
    topics: z.array(text(1, 300)).max(50).optional(),
    clos: z.array(text(1, 300)).max(30).optional(),
    status: z.enum(["draft", "approved"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No changes provided.");
export const generatorSchema = z.strictObject({
  course_id: id,
  assessment_id: id.nullable().optional(),
  assessment_type: z.enum(["quiz", "midterm", "final"]),
  count: z.number().int().min(1).max(20),
  marks_each: z.number().positive().max(1000),
  difficulty: z.enum(["easy", "medium", "hard"]),
  clo: z.string().trim().max(300).default(""),
});
export const questionUpdateSchema = z
  .strictObject({
    question_text: text(5, 5000).optional(),
    marks: z.number().positive().max(1000).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    clo: z.string().trim().max(300).optional(),
    status: z.enum(["draft", "approved"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No changes provided.");
export const roadmapSchema = z.strictObject({
  horizon_days: z.number().int().min(7).max(120).default(60),
});
export const readSchema = z.strictObject({ id, is_read: z.boolean() });
export { id as idSchema };
