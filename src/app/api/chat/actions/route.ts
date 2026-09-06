import { z } from "zod";
import { authenticated, body, checkOrigin, fail, respond } from "@/lib/api";
import { decideAssistantAction } from "@/lib/ai/actions";
const decisionSchema = z.strictObject({
  action_id: z.uuid(),
  decision: z.enum(["approve", "cancel"]),
});
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user } = await authenticated();
    const input = decisionSchema.parse(await body(request));
    return respond(
      await decideAssistantAction(
        user.id,
        input.action_id,
        input.decision === "approve",
      ),
    );
  } catch (error) {
    return fail(error);
  }
}
