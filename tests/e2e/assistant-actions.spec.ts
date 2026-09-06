import { test, expect, request as playwrightRequest } from "@playwright/test";
import {
  testDatabase,
  createTestUser,
  removeTestUsers,
} from "../../scripts/test-fixtures.mjs";

test("assistant proposals require owner approval and manage tasks, courses, and quizzes", async ({
  page,
}) => {
  const database = await testDatabase();
  const users = [
    await createTestUser(database),
    await createTestUser(database),
  ];
  const other = await playwrightRequest.newContext({
    baseURL: "http://localhost:3011",
  });
  const propose = async (
    kind: string,
    payload: Record<string, unknown>,
    summary: string,
  ) => {
    const row = await database.query(
      "insert into public.assistant_actions(user_id,kind,payload,summary) values($1,$2,$3,$4) returning id",
      [users[0].id, kind, JSON.stringify(payload), summary],
    );
    return row.rows[0].id as string;
  };
  const decide = (id: string, decision = "approve") =>
    page.request.post("/api/chat/actions", {
      data: { action_id: id, decision },
    });
  try {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(users[0].email);
    await page.getByLabel("Password", { exact: true }).fill(users[0].password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    expect(
      (
        await other.post("/api/auth/login", {
          data: { email: users[1].email, password: users[1].password },
        })
      ).ok(),
    ).toBe(true);
    const taskId = await propose(
      "task.create",
      {
        title: "AI managed grading",
        description: "Moderate scripts",
        due_at: null,
        priority: "high",
        category: "Grading",
        course_code: "",
        status: "pending",
      },
      "Create task AI managed grading.",
    );
    expect(
      (
        await other.post("/api/chat/actions", {
          data: { action_id: taskId, decision: "approve" },
        })
      ).status(),
    ).toBe(404);
    expect((await decide(taskId)).ok()).toBe(true);
    expect(
      (
        await (
          await page.request.get("/api/tasks?q=AI%20managed%20grading")
        ).json()
      ).total,
    ).toBe(1);
    expect((await decide(taskId)).status()).toBe(409);
    const task = (
      await (
        await page.request.get("/api/tasks?q=AI%20managed%20grading")
      ).json()
    ).tasks[0];
    const deleteTask = await propose(
      "task.delete",
      { id: task.id },
      "Delete task AI managed grading.",
    );
    expect((await decide(deleteTask, "cancel")).ok()).toBe(true);
    expect(
      (
        await (
          await page.request.get("/api/tasks?q=AI%20managed%20grading")
        ).json()
      ).total,
    ).toBe(1);
    const deleteTask2 = await propose(
      "task.delete",
      { id: task.id },
      "Delete task AI managed grading.",
    );
    expect((await decide(deleteTask2)).ok()).toBe(true);
    expect(
      (
        await (
          await page.request.get("/api/tasks?q=AI%20managed%20grading")
        ).json()
      ).total,
    ).toBe(0);
    const createCourse = await propose(
      "course.create",
      {
        code: "AI101",
        title: "AI Managed Course",
        semester_start: "2026-09-01",
        semester_end: "2026-12-20",
      },
      "Create course AI101.",
    );
    expect((await decide(createCourse)).ok()).toBe(true);
    const course = (
      await (await page.request.get("/api/faculty")).json()
    ).courses.find((c: { code: string }) => c.code === "AI101");
    expect(course).toBeTruthy();
    const createQuiz = await propose(
      "quiz.create",
      {
        course_id: course.id,
        title: "AI Managed Quiz",
        scheduled_on: "2026-10-01",
        marks: 10,
        weight_percent: 10,
        topics: ["Introduction"],
      },
      "Create quiz AI Managed Quiz.",
    );
    expect((await decide(createQuiz)).ok()).toBe(true);
    let faculty = await (await page.request.get("/api/faculty")).json();
    const quiz = faculty.assessments.find(
      (a: { title: string }) => a.title === "AI Managed Quiz",
    );
    expect(quiz).toBeTruthy();
    const deleteQuiz = await propose(
      "quiz.delete",
      { id: quiz.id },
      "Delete quiz AI Managed Quiz.",
    );
    expect((await decide(deleteQuiz)).ok()).toBe(true);
    faculty = await (await page.request.get("/api/faculty")).json();
    expect(
      faculty.assessments.some((a: { id: string }) => a.id === quiz.id),
    ).toBe(false);
    const deleteCourse = await propose(
      "course.delete",
      { id: course.id },
      "Delete course AI101 and related records.",
    );
    expect((await decide(deleteCourse)).ok()).toBe(true);
    faculty = await (await page.request.get("/api/faculty")).json();
    expect(
      faculty.courses.some((c: { id: string }) => c.id === course.id),
    ).toBe(false);
  } finally {
    await other.dispose();
    await removeTestUsers(database, users);
    await database.end();
  }
});
