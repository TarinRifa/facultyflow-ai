import { z } from "zod";
export const priorities = ["low", "medium", "high", "urgent"] as const;
export const statuses = ["pending", "in_progress", "completed"] as const;
export const loginSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.trim().toLowerCase()),
    password: z.string().min(8).max(128),
  })
  .strict();
export const registerSchema = loginSchema
  .extend({ display_name: z.string().trim().min(2).max(100) })
  .strict();
export const taskSchema = z
  .object({
    title: z.string().trim().min(1, "Please enter a title.").max(160),
    description: z.string().trim().max(4000),
    due_at: z.iso.datetime({ offset: true }).nullable(),
    priority: z.enum(priorities),
    category: z.string().trim().max(60),
    course_code: z
      .string()
      .trim()
      .max(30)
      .transform((v) => v.toUpperCase()),
    status: z.enum(statuses),
  })
  .strict();
export const updateSchema = taskSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No changes provided.");
export const filtersSchema = z
  .object({
    q: z.string().trim().max(120).default(""),
    status: z.enum(["all", "active", ...statuses]).default("all"),
    priority: z.enum(["all", ...priorities]).default("all"),
    category: z.string().trim().max(60).default(""),
    course: z.string().trim().max(30).default(""),
    period: z.enum(["all", "today", "upcoming", "overdue"]).default("all"),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    sort: z.enum(["due", "priority", "updated"]).default("due"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "Start date must be before end date.",
  );
export type TaskInput = z.infer<typeof taskSchema>;
export type Filters = z.infer<typeof filtersSchema>;
