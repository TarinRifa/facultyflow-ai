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
import { updateSchema } from "@/lib/validation";
type Context = { params: Promise<{ id: string }> };
async function target(context: Context) {
  return z.uuid().parse((await context.params).id);
}
export async function GET(_request: Request, context: Context) {
  try {
    const { client, user } = await authenticated();
    const { data, error } = await client
      .from("tasks")
      .select("*")
      .eq("id", await target(context))
      .eq("user_id", user.id)
      .maybeSingle();
    databaseError(error);
    if (!data) throw new ApiError(404, "Task not found.");
    return respond({ task: data });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { client, user } = await authenticated();
    const input = updateSchema.parse(await body(request));
    const { data, error } = await client
      .from("tasks")
      .update(input)
      .eq("id", await target(context))
      .eq("user_id", user.id)
      .select()
      .maybeSingle();
    databaseError(error);
    if (!data) throw new ApiError(404, "Task not found.");
    return respond({ task: data });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { client, user } = await authenticated();
    const { data, error } = await client
      .from("tasks")
      .delete()
      .eq("id", await target(context))
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    databaseError(error);
    if (!data) throw new ApiError(404, "Task not found.");
    return respond({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
