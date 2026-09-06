import { body, checkOrigin, fail, respond } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { createAdmin, listAccounts, makeAdmin } from "@/lib/admin";
import { createAdminSchema, promoteUserSchema } from "@/lib/admin-validation";

export async function GET() {
  try {
    await requireAdmin();
    return respond({ users: await listAccounts() });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    await requireAdmin();
    const input = promoteUserSchema.parse(await body(request));
    return respond({ user: await makeAdmin(input.user_id) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await requireAdmin();
    const input = createAdminSchema.parse(await body(request));
    return respond({ user: await createAdmin(input) }, 201);
  } catch (error) {
    return fail(error);
  }
}
