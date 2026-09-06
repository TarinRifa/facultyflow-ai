import { z } from "zod";
import {
  authenticated,
  ApiError,
  body,
  checkOrigin,
  databaseError,
  fail,
  respond,
} from "@/lib/api";
import { db } from "@/lib/db";
import { updateSchema } from "@/lib/validation";
type Context = { params: Promise<{ id: string }> };
async function target(context: Context) {
  return z.uuid().parse((await context.params).id);
}
export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await authenticated();
    const result = await db.query(
      "select * from public.tasks where id=$1 and user_id=$2",
      [await target(context), user.id],
    );
    if (!result.rows[0]) throw new ApiError(404, "Task not found.");
    return respond({ task: result.rows[0] });
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
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { user } = await authenticated();
    const input = updateSchema.parse(await body(request));
    const entries = Object.entries(input);
    const values = entries.map(([, value]) => value);
    values.push(await target(context), user.id);
    const set = entries.map(([key], index) => `${key}=$${index + 1}`).join(",");
    const result = await db.query(
      `update public.tasks set ${set} where id=$${values.length - 1} and user_id=$${values.length} returning *`,
      values,
    );
    if (!result.rows[0]) throw new ApiError(404, "Task not found.");
    return respond({ task: result.rows[0] });
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
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { user } = await authenticated();
    const result = await db.query(
      "delete from public.tasks where id=$1 and user_id=$2 returning id",
      [await target(context), user.id],
    );
    if (!result.rows[0]) throw new ApiError(404, "Task not found.");
    return respond({ deleted: true });
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
