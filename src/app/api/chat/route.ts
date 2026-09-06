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
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user } = await authenticated();
    const input = chatSchema.parse(await body(request));
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
      return respond(
        await Promise.race([runChat(user.id, input, signal), timeout]),
      );
    } finally {
      if (listener) signal.removeEventListener("abort", listener);
    }
  } catch (error) {
    return fail(error);
  }
}
