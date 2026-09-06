import { checkOrigin, fail, respond } from "@/lib/api";
import { logout } from "@/lib/auth";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await logout();
    return respond({ signedOut: true });
  } catch (error) {
    return fail(error);
  }
}
