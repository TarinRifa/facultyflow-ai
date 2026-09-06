import { z } from "zod";
import { dateBoundary } from "../dates";
import { priorities, statuses } from "../validation";
import { actionToolSchemas, type AssistantAction } from "./actions";

const date = z.iso.date().refine((value) => {
  try {
    dateBoundary(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid calendar date.");
const scope = {
  category: z.string().trim().max(60).optional(),
  course: z
    .string()
    .trim()
    .max(30)
    .optional()
    .describe("Exact course code, e.g. CSE101"),
  course_prefix: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .optional()
    .describe("Course family, e.g. CSE"),
};
const range = { from: date.optional(), to: date.optional() };
const ordered = (v: { from?: string; to?: string }) =>
  !v.from || !v.to || v.from <= v.to;
export const searchSchema = z
  .strictObject({
    ...scope,
    ...range,
    q: z.string().trim().max(120).optional(),
    statuses: z.array(z.enum(statuses)).min(1).max(3).optional(),
    priorities: z.array(z.enum(priorities)).min(1).max(4).optional(),
    period: z.enum(["all", "today", "upcoming", "overdue"]).default("all"),
    limit: z.number().int().min(1).max(20).default(10),
    sort: z.enum(["due", "priority", "updated"]).default("due"),
  })
  .refine(ordered, "Start date must precede end date.");
export const summarySchema = z
  .strictObject({ ...scope, ...range })
  .refine(ordered, "Start date must precede end date.");
export const recommendationSchema = z.strictObject({
  ...scope,
  target_date: date.optional(),
  limit: z.number().int().min(1).max(20).default(5),
});
export const toolSchemas = {
  search_tasks: searchSchema,
  get_task_summary: summarySchema,
  get_priority_recommendations: recommendationSchema,
  ...actionToolSchemas,
};
export const chatSchema = z.strictObject({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.strictObject({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().min(1).max(4000),
      }),
    )
    .max(6)
    .default([]),
});
export type ChatInput = z.infer<typeof chatSchema>;
export type TaskReference = {
  id: string;
  title: string;
  due_at: string | null;
  priority: string;
  status: string;
};
export type ChatReply = {
  answer: string;
  tasks: TaskReference[];
  actions: AssistantAction[];
};
