import {
  authenticated,
  body,
  checkOrigin,
  databaseError,
  fail,
  respond,
} from "@/lib/api";
import { db } from "@/lib/db";
import { filtersSchema, taskSchema } from "@/lib/validation";
import { listTasks } from "@/lib/tasks";
export async function GET(request: Request) {
  try {
    const { user } = await authenticated();
    return respond(
      await listTasks(
        user.id,
        filtersSchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        ),
      ),
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user } = await authenticated();
    const input = taskSchema.parse(await body(request));
    const values = [
      user.id,
      input.title,
      input.description,
      input.due_at,
      input.priority,
      input.category,
      input.course_code,
      input.status,
    ];
    const result = await db.query(
      "insert into public.tasks(user_id,title,description,due_at,priority,category,course_code,status) values($1,$2,$3,$4,$5,$6,$7,$8) returning *",
      values,
    );
    return respond({ task: result.rows[0] }, 201);
  } catch (error) {
    if ((error as { code?: string }).code)
      try {
        databaseError(error);
      } catch (mapped) {
        return fail(mapped);
      }
    return fail(error);
  }
}
