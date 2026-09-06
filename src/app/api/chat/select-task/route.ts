import { z } from "zod";
import {
  authenticated,
  body,
  checkOrigin,
  fail,
  respond,
  ApiError,
} from "@/lib/api";
import { transaction } from "@/lib/db";
const schema = z.strictObject({ action_id: z.uuid(), task_id: z.uuid() });
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user } = await authenticated();
    const input = schema.parse(await body(request));
    const action = await transaction(async (client) => {
      const picker = (
        await client.query(
          "select * from public.assistant_actions where id=$1 and user_id=$2 for update",
          [input.action_id, user.id],
        )
      ).rows[0];
      if (
        !picker ||
        picker.kind !== "task.delete" ||
        !picker.payload.selection_required
      )
        throw new ApiError(404, "Task picker not found.");
      if (
        picker.status !== "pending" ||
        new Date(picker.expires_at) <= new Date()
      )
        throw new ApiError(
          409,
          "This picker has expired or was already used. Ask to delete a task again.",
        );
      const task = (
        await client.query(
          "select id,title from public.tasks where id=$1 and user_id=$2",
          [input.task_id, user.id],
        )
      ).rows[0];
      if (!task)
        throw new ApiError(
          404,
          "Task no longer exists. Refresh the task list.",
        );
      const proposal = (
        await client.query(
          "insert into public.assistant_actions(user_id,kind,payload,summary) values($1,'task.delete',$2,$3) returning id,kind,summary,status,expires_at",
          [
            user.id,
            JSON.stringify({ id: task.id }),
            "Delete task “" + task.title + "”.",
          ],
        )
      ).rows[0];
      await client.query(
        "update public.assistant_actions set status='cancelled' where id=$1",
        [picker.id],
      );
      await client.query(
        "insert into public.chat_messages(user_id,role,text,actions) values($1,'assistant',$2,$3)",
        [
          user.id,
          "Confirm deletion of “" + task.title + "”.",
          JSON.stringify([proposal]),
        ],
      );
      return proposal;
    });
    return respond({ action });
  } catch (e) {
    return fail(e);
  }
}
