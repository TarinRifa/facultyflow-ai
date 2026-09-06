import { body, checkOrigin, fail, respond } from "@/lib/api";
import { register } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = registerSchema.parse(await body(request));
    const user = await register(
      input.display_name,
      input.email,
      input.password,
    );
    return respond({ user }, 201);
  } catch (error) {
    return fail(error);
  }
}
