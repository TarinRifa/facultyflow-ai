import { body, checkOrigin, fail, respond } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getAcademicSettings, saveAcademicSettings } from "@/lib/admin";
import { academicSettingsSchema } from "@/lib/admin-validation";

export async function GET() {
  try {
    await requireAdmin();
    return respond({ settings: await getAcademicSettings() });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin();
    const input = academicSettingsSchema.parse(await body(request));
    return respond({ settings: await saveAcademicSettings(admin.id, input) });
  } catch (error) {
    return fail(error);
  }
}
