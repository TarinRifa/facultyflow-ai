import { body, checkOrigin, fail, respond } from "@/lib/api";
import { login } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = loginSchema.parse(await body(request));
    return respond({ user: await login(input.email, input.password) });
  } catch (error) {
    return fail(error);
  }
}
