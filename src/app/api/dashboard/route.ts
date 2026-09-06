import { authenticated, fail, respond } from "@/lib/api";
import { dashboard } from "@/lib/tasks";
export async function GET() {
  try {
    const { client, user } = await authenticated();
    return respond(await dashboard(client, user.id));
  } catch (e) {
    return fail(e);
  }
}
