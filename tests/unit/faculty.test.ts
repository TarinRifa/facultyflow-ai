import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  courseSchema,
  syllabusSchema,
  routineSchema,
  plannerSchema,
  assessmentUpdateSchema,
  generatorSchema,
  questionUpdateSchema,
  roadmapSchema,
} from "../../src/lib/faculty-validation";
import { cosine } from "../../src/lib/faculty-ai";
import { splitQuestions } from "../../src/lib/file-text";

const id = "00000000-0000-4000-8000-000000000001";
describe("faculty workflow validation", () => {
  it("normalizes course codes and validates semester order", () => {
    expect(
      courseSchema.parse({
        code: " cse401 ",
        title: "Artificial Intelligence",
        semester_start: "2026-09-01",
        semester_end: "2026-12-20",
      }).code,
    ).toBe("CSE401");
    expect(
      courseSchema.safeParse({
        code: "CSE401",
        title: "AI",
        semester_start: "2026-12-20",
        semester_end: "2026-09-01",
      }).success,
    ).toBe(false);
  });
  it("bounds syllabus progress and rejects injected ownership fields", () => {
    const base = {
      course_id: id,
      content: "A sufficiently detailed syllabus description",
      source_name: "Manual",
      clos: [],
      topics: ["Search"],
      progress_percent: 55,
    };
    expect(syllabusSchema.safeParse(base).success).toBe(true);
    expect(syllabusSchema.safeParse({ ...base, user_id: id }).success).toBe(
      false,
    );
    expect(
      syllabusSchema.safeParse({ ...base, progress_percent: 101 }).success,
    ).toBe(false);
  });
  it("checks routine times and assessment selection", () => {
    expect(
      routineSchema.safeParse({
        course_id: id,
        weekday: 1,
        start_time: "11:00",
        end_time: "10:00",
        room: "",
      }).success,
    ).toBe(false);
    expect(
      plannerSchema.safeParse({
        course_id: id,
        quiz_count: 0,
        include_midterm: false,
        include_final: false,
      }).success,
    ).toBe(false);
  });
  it("bounds dates, marks, weights, difficulty and IDs", () => {
    expect(
      assessmentUpdateSchema.safeParse({ scheduled_on: "2026-02-30" }).success,
    ).toBe(false);
    expect(assessmentUpdateSchema.safeParse({ marks: 0 }).success).toBe(false);
    expect(
      generatorSchema.safeParse({
        course_id: "other",
        assessment_type: "quiz",
        count: 2,
        marks_each: 5,
        difficulty: "medium",
        clo: "CLO1",
      }).success,
    ).toBe(false);
    expect(
      questionUpdateSchema.safeParse({ difficulty: "impossible" }).success,
    ).toBe(false);
    expect(roadmapSchema.safeParse({ horizon_days: 365 }).success).toBe(false);
  });
});
describe("semantic helpers", () => {
  it("computes bounded cosine percentages", () => {
    expect(cosine([1, 0], [1, 0])).toBe(100);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1], [1, 2])).toBe(0);
  });
  it("extracts unique numbered questions with bounds", () => {
    expect(
      splitQuestions(
        "1. Explain informed search?\n2. Compare search strategies?\n2. Compare search strategies?",
      ),
    ).toEqual(["Explain informed search?", "Compare search strategies?"]);
  });
});
