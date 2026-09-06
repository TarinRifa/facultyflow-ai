import {
  authenticated,
  body,
  checkOrigin,
  fail,
  respond,
  ApiError,
} from "@/lib/api";
import { chatSchema } from "@/lib/ai/schema";
import { runChat } from "@/lib/ai/chat";
import { appendChat, chatContext } from "@/lib/chat-history";
import { proposeAssistantAction } from "@/lib/ai/actions";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user } = await authenticated();
    const input = chatSchema.parse(await body(request));
    input.history = await chatContext(user.id);
    await appendChat(user.id, "user", input.message);
    if (
      /^(?:(?:please|can you|could you|i want to|i would like to)\s+)*(?:delete|remove)\b.*\btask\b/i.test(
        input.message,
      )
    ) {
      const action = await proposeAssistantAction(user.id, "manage_task", {
        action: "delete",
      });
      const reply = {
        answer:
          "Choose a current task below. I’ll ask you to confirm before deleting it.",
        tasks: [],
        actions: [action],
      };
      await appendChat(user.id, "assistant", reply.answer, reply);
      return respond(reply);
    }
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(45000),
    ]);
    let listener: (() => void) | undefined;
    const timeout = new Promise<never>((_, reject) => {
      listener = () =>
        reject(new ApiError(504, "The assistant took too long. Please retry."));
      signal.addEventListener("abort", listener, { once: true });
      if (signal.aborted) listener();
    });
    try {
      const reply = await Promise.race([
        runChat(user.id, input, signal),
        timeout,
      ]);
      await appendChat(user.id, "assistant", reply.answer, reply);
      return respond(reply);
    } catch (error) {
      await appendChat(
        user.id,
        "assistant",
        "I could not complete that request. Please retry. Any proposed changes still require approval.",
      );
      throw error;
    } finally {
      if (listener) signal.removeEventListener("abort", listener);
    }
  } catch (error) {
    return fail(error);
  }
}
