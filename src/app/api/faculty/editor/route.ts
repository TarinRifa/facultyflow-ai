import { authenticated, checkOrigin, fail, respond, ApiError } from "@/lib/api";
import {
  assessmentFormSchema,
  questionSetSchema,
} from "@/lib/editor-validation";
import { saveAssessment, saveQuestions } from "@/lib/editors";
import { db } from "@/lib/db";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user } = await authenticated();
    const text = await request.text();
    if (text.length > 2000000)
      throw new ApiError(413, "Editor content is too large.");
    const raw = JSON.parse(text);
    if (new URL(request.url).searchParams.get("type") === "questions")
      return respond(
        await saveQuestions(user.id, questionSetSchema.parse(raw)),
      );
    return respond({
      assessment: await saveAssessment(
        user.id,
        assessmentFormSchema.parse(raw),
      ),
    });
  } catch (e) {
    if ((e as {code?:string}).code === "23505")
      return fail(new ApiError(409, "A duplicate question or assessment already exists. Refresh and try again."));
    return fail(e);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const { user } = await authenticated();
    const { z } = await import("zod");
    const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
    const result = await db.query(
      "delete from public.assessments a using public.courses c where a.id=$1 and a.course_id=c.id and c.user_id=$2 returning a.id",
      [id, user.id],
    );
    if (!result.rowCount) throw new ApiError(404, "Assessment not found.");
    return respond({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
