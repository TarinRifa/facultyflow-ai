import { authenticated, fail, respond } from "@/lib/api";
import { dashboard } from "@/lib/tasks";
export async function GET() {
  try {
    const { user } = await authenticated();
    return respond(await dashboard(user.id));
  } catch (error) {
    return fail(error);
  }
}
