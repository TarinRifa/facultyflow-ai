import { authenticated, fail, respond } from "@/lib/api";
import { facultyWorkspace } from "@/lib/faculty";
export const runtime = "nodejs";
export async function GET() {
  try {
    const { user } = await authenticated();
    return respond(await facultyWorkspace(user.id));
  } catch (error) {
    return fail(error);
  }
}
