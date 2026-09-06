import {
  authenticated,
  body,
  checkOrigin,
  databaseError,
  fail,
  respond,
} from "@/lib/api";
import { filtersSchema, taskSchema } from "@/lib/validation";
import { listTasks } from "@/lib/tasks";
export async function GET(request: Request) {
  try {
    const { client, user } = await authenticated();
    return respond(
      await listTasks(
        client,
        user.id,
        filtersSchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        ),
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { client, user } = await authenticated();
    const input = taskSchema.parse(await body(request));
    const { data, error } = await client
      .from("tasks")
      .insert({ ...input, user_id: user.id })
      .select()
      .single();
    databaseError(error);
    return respond({ task: data }, 201);
  } catch (e) {
    return fail(e);
  }
}
