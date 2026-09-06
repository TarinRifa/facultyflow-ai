import { test, expect, request as playwrightRequest } from "@playwright/test";
import {
  testDatabase,
  testUser,
  createTestUser,
  removeTestUsers,
} from "../../scripts/test-fixtures.mjs";
let database: Awaited<ReturnType<typeof testDatabase>>;
const users: ReturnType<typeof testUser>[] = [];
test.beforeAll(async () => {
  database = await testDatabase();
  users.push(testUser());
  users.push(await createTestUser(database));
});
test.afterAll(async () => {
  if (database) {
    await removeTestUsers(database, users);
    await database.end();
  }
});
test("registration, task lifecycle, filters, dashboard, and account isolation", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/login");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill(users[0].display_name);
  await page.getByLabel("Email address").fill(users[0].email);
  await page.getByLabel("Password", { exact: true }).fill(users[0].password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText("A little breathing room.")).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Task title").fill("Prepare CSE101 lecture");
  await page.getByLabel("Description").fill("Review graphs and trees");
  await page.getByLabel("Course code").fill("cse101");
  await page.getByLabel("Category", { exact: true }).fill("Teaching");
  await page.getByLabel("Priority", { exact: true }).selectOption("high");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20000 });
  const list = await page.request.get("/api/tasks");
  expect(list.ok()).toBe(true);
  const task = (await list.json()).tasks[0];
  expect(task).toMatchObject({
    course_code: "CSE101",
    title: "Prepare CSE101 lecture",
  });
  expect(
    (await (await page.request.get("/api/dashboard")).json()).pending,
  ).toBe(1);
  await page.goto("/tasks");
  await expect(
    page.getByRole("button", { name: task.title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: task.title, exact: true }).click();
  await page.getByLabel("Task title").fill("Updated lecture plan");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20000 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Updated lecture plan", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search tasks").fill("does not exist");
  await expect(page.getByText("Nothing here just yet.")).toBeVisible();
  await page.getByLabel("Search tasks").fill("Updated");
  await expect(
    page.getByRole("button", { name: "Updated lecture plan", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Complete Updated lecture plan", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/dashboard")).json()).completed,
    )
    .toBe(1);
  expect(
    (await (await page.request.get("/api/tasks/" + task.id)).json()).task
      .completed_at,
  ).not.toBeNull();
  await page
    .getByRole("button", { name: "Reopen Updated lecture plan", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/tasks/" + task.id)).json()).task
          .completed_at,
    )
    .toBeNull();
  const past = new Date(Date.now() - 86400000).toISOString();
  expect(
    (
      await page.request.patch("/api/tasks/" + task.id, {
        data: { due_at: past },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (await (await page.request.get("/api/dashboard")).json()).overdue,
  ).toBe(1);
  expect(
    (
      await (
        await page.request.get(
          "/api/tasks?period=overdue&priority=high&course=CSE101&category=Teaching&q=Updated",
        )
      ).json()
    ).total,
  ).toBe(1);
  expect(
    (
      await page.request.post("/api/tasks", {
        data: { title: "bad", user_id: "other" },
      })
    ).status(),
  ).toBe(400);
  const other = await playwrightRequest.newContext({
    baseURL: "http://localhost:3011",
  });
  expect(
    (
      await other.post("/api/auth/login", {
        data: { email: users[1].email, password: users[1].password },
      })
    ).ok(),
  ).toBe(true);
  expect((await (await other.get("/api/tasks")).json()).total).toBe(0);
  expect((await other.get("/api/tasks/" + task.id)).status()).toBe(404);
  expect(
    (
      await other.patch("/api/tasks/" + task.id, {
        data: { title: "intrusion" },
      })
    ).status(),
  ).toBe(404);
  expect((await other.delete("/api/tasks/" + task.id)).status()).toBe(404);
  expect(
    (
      await other.post("/api/tasks", {
        data: { title: "intrusion", user_id: task.user_id },
      })
    ).status(),
  ).toBe(400);
  await other.dispose();
  await page.getByLabel("Search tasks").fill("");
  await page.goto("/tasks");
  await page
    .getByRole("button", { name: "Delete Updated lecture plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20000 });
  await expect
    .poll(
      async () => (await (await page.request.get("/api/tasks")).json()).total,
    )
    .toBe(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect((await page.request.get("/api/tasks")).status()).toBe(401);
});
