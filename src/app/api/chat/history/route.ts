import { authenticated, fail, respond } from "@/lib/api";
import { chatHistory } from "@/lib/chat-history";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const { user } = await authenticated();
    const before = z
      .string()
      .regex(/^[1-9]\d{0,17}$/)
      .nullable()
      .parse(new URL(request.url).searchParams.get("before"));
    return respond(await chatHistory(user.id, before || undefined));
  } catch (error) {
    return fail(error);
  }
}
