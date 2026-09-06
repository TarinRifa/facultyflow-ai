import "server-only";
import { z } from "zod";
import { db, transaction } from "../db";
import { ApiError } from "../api-error";
import { taskSchema } from "../validation";
import { courseSchema } from "../faculty-validation";

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).optional();
export const taskActionSchema = z.strictObject({
  action: z.enum(["create", "delete"]),
  target_title: optionalText(160),
  title: optionalText(160),
  description: z.string().trim().max(4000).optional(),
  due_at: z.iso.datetime({ offset: true }).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  category: z.string().trim().max(60).optional(),
  course_code: z.string().trim().max(30).optional(),
});
export const courseActionSchema = z.strictObject({
  action: z.enum(["create", "delete"]),
  target_code: optionalText(30),
  code: optionalText(30),
  title: optionalText(160),
  semester_start: z.iso.date().optional(),
  semester_end: z.iso.date().optional(),
});
export const quizActionSchema = z.strictObject({
  action: z.enum(["create", "delete"]),
  course_code: z.string().trim().min(2).max(30),
  target_title: optionalText(160),
  title: optionalText(160),
  scheduled_on: z.iso.date().optional(),
  marks: z.number().positive().max(1000).optional(),
  weight_percent: z.number().positive().max(100).optional(),
  topics: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
});
export const actionToolSchemas = {
  manage_task: taskActionSchema,
  manage_course: courseActionSchema,
  manage_quiz: quizActionSchema,
};
export type AssistantAction = {
  id: string;
  kind: string;
  summary: string;
  expires_at: string;
  status: string;
};
async function one<T extends Record<string, unknown>>(
  text: string,
  values: unknown[],
  label: string,
) {
  const rows = (await db.query<T>(text, values)).rows;
  if (!rows.length) throw new ApiError(404, `${label} was not found.`);
  if (rows.length > 1)
    throw new ApiError(
      409,
      `More than one ${label.toLowerCase()} matches. Use the exact name.`,
    );
  return rows[0];
}
export async function proposeAssistantAction(
  userId: string,
  name: keyof typeof actionToolSchemas,
  args: unknown,
): Promise<AssistantAction> {
  const input = actionToolSchemas[name].parse(args);
  let kind = "",
    payload: Record<string, unknown> = {},
    summary = "";
  if (name === "manage_task") {
    const v = taskActionSchema.parse(input);
    kind = `task.${v.action}`;
    if (v.action === "create") {
      const valid = taskSchema.parse({
        title: v.title,
        description: v.description || "",
        due_at: v.due_at ?? null,
        priority: v.priority || "medium",
        category: v.category || "",
        course_code: (v.course_code || "").toUpperCase(),
        status: "pending",
      });
      payload = valid;
      summary = `Create task “${valid.title}”${valid.course_code ? ` for ${valid.course_code}` : ""}.`;
    } else {
      if (!v.target_title)
        throw new ApiError(400, "Give the exact task title to delete.");
      const target = await one<{ id: string; title: string }>(
        "select id,title from public.tasks where user_id=$1 and lower(title)=lower($2) limit 2",
        [userId, v.target_title],
        "Task",
      );
      payload = { id: target.id };
      summary = `Delete task “${target.title}”.`;
    }
  } else if (name === "manage_course") {
    const v = courseActionSchema.parse(input);
    kind = `course.${v.action}`;
    if (v.action === "create") {
      const valid = courseSchema.parse({
        code: v.code,
        title: v.title,
        semester_start: v.semester_start,
        semester_end: v.semester_end,
      });
      payload = valid;
      summary = `Create course ${valid.code} · ${valid.title}.`;
    } else {
      if (!v.target_code)
        throw new ApiError(400, "Give the exact course code to delete.");
      const target = await one<{ id: string; code: string; title: string }>(
        "select id,code,title from public.courses where user_id=$1 and upper(code)=upper($2) limit 2",
        [userId, v.target_code],
        "Course",
      );
      payload = { id: target.id };
      summary = `Delete course ${target.code} · ${target.title} and all related syllabus, quizzes, questions, analyses, and roadmap data.`;
    }
  } else {
    const v = quizActionSchema.parse(input);
    kind = `quiz.${v.action}`;
    const course = await one<{
      id: string;
      code: string;
      semester_start: Date | string;
      semester_end: Date | string;
    }>(
      "select id,code,semester_start,semester_end from public.courses where user_id=$1 and upper(code)=upper($2) limit 2",
      [userId, v.course_code],
      "Course",
    );
    if (v.action === "create") {
      if (!v.title || !v.scheduled_on || !v.marks || !v.weight_percent)
        throw new ApiError(
          400,
          "A quiz needs title, date, marks, and weight percentage.",
        );
      const start =
          course.semester_start instanceof Date
            ? course.semester_start.toISOString().slice(0, 10)
            : String(course.semester_start).slice(0, 10),
        end =
          course.semester_end instanceof Date
            ? course.semester_end.toISOString().slice(0, 10)
            : String(course.semester_end).slice(0, 10);
      if (v.scheduled_on < start || v.scheduled_on > end)
        throw new ApiError(
          400,
          "Quiz date must be inside the course semester.",
        );
      const total = Number(
        (
          await db.query(
            "select coalesce(sum(weight_percent),0)::float total from public.assessments where course_id=$1",
            [course.id],
          )
        ).rows[0].total,
      );
      if (total + v.weight_percent > 100.001)
        throw new ApiError(
          400,
          "This quiz would make course assessment weights exceed 100%.",
        );
      payload = {
        course_id: course.id,
        title: v.title,
        scheduled_on: v.scheduled_on,
        marks: v.marks,
        weight_percent: v.weight_percent,
        topics: v.topics || [],
      };
      summary = `Create quiz “${v.title}” for ${course.code} on ${v.scheduled_on}, worth ${v.marks} marks and ${v.weight_percent}%.`;
    } else {
      if (!v.target_title)
        throw new ApiError(400, "Give the exact quiz title to delete.");
      const target = await one<{ id: string; title: string }>(
        "select id,title from public.assessments where course_id=$1 and kind='quiz' and lower(title)=lower($2) limit 2",
        [course.id, v.target_title],
        "Quiz",
      );
      payload = { id: target.id };
      summary = `Delete quiz “${target.title}” from ${course.code}.`;
    }
  }
  return (
    await db.query<AssistantAction>(
      "insert into public.assistant_actions(user_id,kind,payload,summary) values($1,$2,$3,$4) returning id,kind,summary,status,expires_at",
      [userId, kind, JSON.stringify(payload), summary],
    )
  ).rows[0];
}
export async function decideAssistantAction(
  userId: string,
  actionId: string,
  approve: boolean,
) {
  return transaction(async (client) => {
    const found = await client.query(
      "select * from public.assistant_actions where id=$1 and user_id=$2 for update",
      [actionId, userId],
    );
    const action = found.rows[0];
    if (!action) throw new ApiError(404, "Action proposal not found.");
    if (action.status !== "pending")
      throw new ApiError(409, "This action has already been decided.");
    if (new Date(action.expires_at) <= new Date()) {
      await client.query(
        "update public.assistant_actions set status='expired' where id=$1",
        [actionId],
      );
      throw new ApiError(
        410,
        "This action proposal expired. Ask the assistant again.",
      );
    }
    if (!approve) {
      await client.query(
        "update public.assistant_actions set status='cancelled' where id=$1",
        [actionId],
      );
      return { status: "cancelled", message: "Action cancelled." };
    }
    const p = action.payload;
    let result;
    if (action.kind === "task.create")
      result = (
        await client.query(
          "insert into public.tasks(user_id,title,description,due_at,priority,category,course_code,status) values($1,$2,$3,$4,$5,$6,$7,$8) returning id,title",
          [
            userId,
            p.title,
            p.description,
            p.due_at,
            p.priority,
            p.category,
            p.course_code,
            p.status,
          ],
        )
      ).rows[0];
    else if (action.kind === "task.delete")
      result = (
        await client.query(
          "delete from public.tasks where id=$1 and user_id=$2 returning id,title",
          [p.id, userId],
        )
      ).rows[0];
    else if (action.kind === "course.create")
      result = (
        await client.query(
          "insert into public.courses(user_id,code,title,semester_start,semester_end) values($1,$2,$3,$4,$5) returning id,code,title",
          [userId, p.code, p.title, p.semester_start, p.semester_end],
        )
      ).rows[0];
    else if (action.kind === "course.delete")
      result = (
        await client.query(
          "delete from public.courses where id=$1 and user_id=$2 returning id,code,title",
          [p.id, userId],
        )
      ).rows[0];
    else if (action.kind === "quiz.create")
      result = (
        await client.query(
          "insert into public.assessments(course_id,kind,title,scheduled_on,marks,weight_percent,topics,clos,rationale,source) select $1,'quiz',$2,$3,$4,$5,$6,'[]','Created through approved assistant action.','faculty' where exists(select 1 from public.courses where id=$1 and user_id=$7) returning id,title",
          [
            p.course_id,
            p.title,
            p.scheduled_on,
            p.marks,
            p.weight_percent,
            JSON.stringify(p.topics),
            userId,
          ],
        )
      ).rows[0];
    else
      result = (
        await client.query(
          "delete from public.assessments a using public.courses c where a.id=$1 and a.course_id=c.id and c.user_id=$2 and a.kind='quiz' returning a.id,a.title",
          [p.id, userId],
        )
      ).rows[0];
    if (!result)
      throw new ApiError(
        404,
        "The target no longer exists or is not owned by you.",
      );
    await client.query(
      "update public.assistant_actions set status='approved',executed_at=now() where id=$1",
      [actionId],
    );
    return {
      status: "approved",
      message: `Completed: ${action.summary}`,
      result,
    };
  });
}
