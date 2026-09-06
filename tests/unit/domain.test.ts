import { describe, it, expect } from "vitest";
import {
  bounds,
  dateBoundary,
  fromInputDate,
  toInputDate,
} from "../../src/lib/dates";
import {
  taskSchema,
  updateSchema,
  filtersSchema,
} from "../../src/lib/validation";
const valid = {
  title: " Grade scripts ",
  description: "",
  due_at: null,
  priority: "high",
  category: "Grading",
  course_code: "cse101",
  status: "pending",
};
describe("task validation", () => {
  it("normalizes title and course code", () => {
    expect(taskSchema.parse(valid)).toMatchObject({
      title: "Grade scripts",
      course_code: "CSE101",
    });
  });
  it("rejects owner spoofing and empty titles", () => {
    expect(taskSchema.safeParse({ ...valid, user_id: "other" }).success).toBe(
      false,
    );
    expect(taskSchema.safeParse({ ...valid, title: " " }).success).toBe(false);
  });
  it("rejects invalid status, date and empty patches", () => {
    expect(taskSchema.safeParse({ ...valid, status: "unknown" }).success).toBe(
      false,
    );
    expect(
      taskSchema.safeParse({ ...valid, due_at: "not-a-date" }).success,
    ).toBe(false);
    expect(updateSchema.safeParse({}).success).toBe(false);
  });
  it("bounds pagination and dates", () => {
    expect(filtersSchema.safeParse({ limit: 500 }).success).toBe(false);
    expect(
      filtersSchema.safeParse({ from: "2026-10-02", to: "2026-10-01" }).success,
    ).toBe(false);
    expect(filtersSchema.parse({}).limit).toBe(12);
  });
});
describe("faculty timezone boundaries", () => {
  it("uses Dhaka calendar day across UTC midnight", () => {
    expect(bounds(new Date("2026-09-06T20:00:00Z")).start).toBe(
      "2026-09-06T18:00:00.000Z",
    );
  });
  it("includes the full seventh future calendar day", () => {
    expect(bounds(new Date("2026-09-06T10:00:00Z")).upcomingEnd).toBe(
      "2026-09-13T18:00:00.000Z",
    );
  });
  it("converts deadline input without browser timezone assumptions", () => {
    expect(fromInputDate("2026-09-06T09:30")).toBe("2026-09-06T03:30:00.000Z");
    expect(toInputDate("2026-09-06T03:30:00Z")).toBe("2026-09-06T09:30");
  });
  it("rejects impossible calendar dates", () => {
    expect(() => dateBoundary("2026-02-30")).toThrow();
  });
  it("uses DST-aware next-day boundaries", () => {
    const b = bounds(new Date("2026-03-08T12:00:00Z"), "America/New_York");
    expect(new Date(b.end).valueOf() - new Date(b.start).valueOf()).toBe(
      23 * 3600000,
    );
  });
});
