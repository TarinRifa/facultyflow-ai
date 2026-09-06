import { z } from "zod";
export const assessmentFormSchema = z.strictObject({
  course_id: z.uuid(),
  id: z.uuid().optional(),
  title: z.string().trim().min(2).max(160),
  kind: z.enum(["quiz", "midterm", "final"]),
  scheduled_on: z.iso.date(),
  marks: z.number().positive().max(1000),
  weight_percent: z.number().positive().max(100),
  topics: z.array(z.string().trim().min(1).max(300)).min(1).max(50),
  clos: z.array(z.string().trim().min(1).max(300)).max(30),
  status: z.enum(["draft", "approved"]),
});
export const questionFormSchema = z
  .strictObject({
    id: z.uuid().optional(),
    assessment_id: z.uuid().nullable(),
    question_text: z.string().trim().min(5).max(5000),
    assessment_type: z.enum(["quiz", "midterm", "final"]),
    marks: z.number().positive().max(1000),
    difficulty: z.enum(["easy", "medium", "hard"]),
    clo: z.string().trim().max(300),
    question_type: z.enum([
      "short_answer",
      "essay",
      "multiple_choice",
      "true_false",
    ]),
    options: z.array(z.string().trim().min(1).max(1000)).max(10),
    answer: z.string().trim().max(5000),
  })
  .superRefine((q, ctx) => {
    if (
      q.question_type === "multiple_choice" &&
      (q.options.length < 2 ||
        new Set(q.options).size !== q.options.length ||
        !q.options.includes(q.answer))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Multiple-choice questions need distinct options and an answer matching an option.",
      });
    if (
      q.question_type === "true_false" &&
      !["True", "False"].includes(q.answer)
    )
      ctx.addIssue({
        code: "custom",
        message: "True/false answers must be True or False.",
      });
  });
export const questionSetSchema = z
  .strictObject({
    course_id: z.uuid(),
    original_ids: z.array(z.uuid()).max(500),
    questions: z.array(questionFormSchema).max(500),
  })
  .superRefine((v, ctx) => {
    const ids = v.questions.flatMap((q) => (q.id ? [q.id] : []));
    if (
      new Set(ids).size !== ids.length ||
      new Set(v.original_ids).size !== v.original_ids.length ||
      ids.some((id) => !v.original_ids.includes(id))
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid or duplicate question IDs.",
      });
    if (
      new Set(v.questions.map((q) => q.question_text)).size !==
      v.questions.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Questions must have distinct text.",
      });
  });
