import { authenticated, checkOrigin, fail, respond, ApiError } from "@/lib/api";
import { extractUpload } from "@/lib/file-text";
import {
  courseSchema,
  syllabusSchema,
  routineSchema,
  plannerSchema,
  assessmentUpdateSchema,
  generatorSchema,
  questionUpdateSchema,
  roadmapSchema,
  readSchema,
  idSchema,
} from "@/lib/faculty-validation";
import {
  createCourse,
  saveSyllabus,
  addRoutine,
  analyzeAssignment,
  generatePlan,
  updateAssessment,
  addPreviousPaper,
  previousMatches,
  generateQuestions,
  updateQuestion,
  deleteQuestion,
  refreshNotifications,
  readNotification,
  generateRoadmap,
} from "@/lib/faculty";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
const json = async (request: Request) => {
  const text = await request.text();
  if (text.length > 150000) throw new ApiError(413, "Request is too large.");
  return JSON.parse(text);
};
const resourceOf = async (context: RouteContext<"/api/faculty/[resource]">) =>
  (await context.params).resource;
export async function POST(
  request: Request,
  context: RouteContext<"/api/faculty/[resource]">,
) {
  try {
    checkOrigin(request);
    const { user } = await authenticated();
    const resource = await resourceOf(context);
    if (resource === "courses")
      return respond(
        {
          course: await createCourse(
            user.id,
            courseSchema.parse(await json(request)),
          ),
        },
        201,
      );
    if (resource === "routines")
      return respond(
        {
          routine: await addRoutine(
            user.id,
            routineSchema.parse(await json(request)),
          ),
        },
        201,
      );
    if (resource === "syllabus") {
      if (
        request.headers.get("content-type")?.includes("multipart/form-data")
      ) {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File))
          throw new ApiError(400, "Choose a syllabus file.");
        const extracted = await extractUpload(file);
        const input = syllabusSchema.parse({
          course_id: form.get("course_id"),
          content: extracted.text,
          source_name: extracted.filename,
          clos: JSON.parse(String(form.get("clos") || "[]")),
          topics: JSON.parse(String(form.get("topics") || "[]")),
          progress_percent: Number(form.get("progress_percent")),
        });
        return respond({ syllabus: await saveSyllabus(user.id, input) });
      }
      return respond({
        syllabus: await saveSyllabus(
          user.id,
          syllabusSchema.parse(await json(request)),
        ),
      });
    }
    if (resource === "assignments") {
      const form = await request.formData();
      const courseId = idSchema.parse(form.get("course_id"));
      const file = form.get("file");
      if (!(file instanceof File))
        throw new ApiError(400, "Choose an assignment file.");
      return respond(
        {
          analysis: await analyzeAssignment(
            user.id,
            courseId,
            await extractUpload(file),
          ),
        },
        201,
      );
    }
    if (resource === "previous-papers") {
      const form = await request.formData();
      const courseId = idSchema.parse(form.get("course_id"));
      const year = z.coerce.number().int().parse(form.get("year"));
      const file = form.get("file");
      if (!(file instanceof File))
        throw new ApiError(400, "Choose a question paper.");
      return respond(
        {
          paper: await addPreviousPaper(
            user.id,
            courseId,
            year,
            await extractUpload(file),
          ),
        },
        201,
      );
    }
    if (resource === "plans")
      return respond(
        {
          assessments: await generatePlan(
            user.id,
            plannerSchema.parse(await json(request)),
          ),
        },
        201,
      );
    if (resource === "questions")
      return respond(
        {
          questions: await generateQuestions(
            user.id,
            generatorSchema.parse(await json(request)),
          ),
        },
        201,
      );
    if (resource === "notifications")
      return respond({ notifications: await refreshNotifications(user.id) });
    if (resource === "roadmap")
      return respond(
        {
          roadmap: await generateRoadmap(
            user.id,
            roadmapSchema.parse(await json(request)),
          ),
        },
        201,
      );
    throw new ApiError(404, "Faculty API resource not found.");
  } catch (error) {
    return fail(error);
  }
}
export async function GET(
  request: Request,
  context: RouteContext<"/api/faculty/[resource]">,
) {
  try {
    const { user } = await authenticated();
    const resource = await resourceOf(context);
    if (resource === "previous-matches") {
      const id = idSchema.parse(
        new URL(request.url).searchParams.get("course_id"),
      );
      return respond({ matches: await previousMatches(user.id, id) });
    }
    throw new ApiError(404, "Faculty API resource not found.");
  } catch (error) {
    return fail(error);
  }
}
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/faculty/[resource]">,
) {
  try {
    checkOrigin(request);
    const { user } = await authenticated();
    const resource = await resourceOf(context);
    const raw = await json(request);
    if (resource === "assessments") {
      const { id, ...changes } = z
        .object({ id: idSchema })
        .passthrough()
        .parse(raw);
      return respond({
        assessment: await updateAssessment(
          user.id,
          id,
          assessmentUpdateSchema.parse(changes),
        ),
      });
    }
    if (resource === "questions") {
      const { id, ...changes } = z
        .object({ id: idSchema })
        .passthrough()
        .parse(raw);
      return respond({
        question: await updateQuestion(
          user.id,
          id,
          questionUpdateSchema.parse(changes),
        ),
      });
    }
    if (resource === "notifications") {
      const input = readSchema.parse(raw);
      return respond({
        notification: await readNotification(user.id, input.id, input.is_read),
      });
    }
    throw new ApiError(404, "Faculty API resource not found.");
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(
  request: Request,
  context: RouteContext<"/api/faculty/[resource]">,
) {
  try {
    checkOrigin(request);
    const { user } = await authenticated();
    const resource = await resourceOf(context);
    if (resource === "questions") {
      const id = idSchema.parse(new URL(request.url).searchParams.get("id"));
      await deleteQuestion(user.id, id);
      return new Response(null, { status: 204 });
    }
    throw new ApiError(404, "Faculty API resource not found.");
  } catch (error) {
    return fail(error);
  }
}
