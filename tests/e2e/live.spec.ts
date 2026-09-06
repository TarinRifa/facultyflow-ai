import { test, expect } from "@playwright/test";
import {
  testDatabase,
  createTestUser,
  removeTestUsers,
} from "../../scripts/test-fixtures.mjs";
import { createClient } from "@supabase/supabase-js";
let database: Awaited<ReturnType<typeof testDatabase>>;
const users: Awaited<ReturnType<typeof createTestUser>>[] = [];
test.beforeAll(async () => {
  database = await testDatabase();
  users.push(await createTestUser(database));
  users.push(await createTestUser(database));
});
test.afterAll(async () => {
  if (database) {
    await removeTestUsers(database, users);
    await database.end();
  }
});
test("real task lifecycle, dashboard counts, filters, and ownership isolation", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(users[0].email);
  await page.getByLabel("Password", { exact: true }).fill(users[0].password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
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
  expect(task.course_code).toBe("CSE101");
  expect(task.title).toBe("Prepare CSE101 lecture");
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
  const completed = await (
    await page.request.get("/api/tasks/" + task.id)
  ).json();
  expect(completed.task.completed_at).not.toBeNull();
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
  const stats = await (await page.request.get("/api/dashboard")).json();
  expect(stats.overdue).toBe(1);
  const filtered = await (
    await page.request.get(
      "/api/tasks?period=overdue&priority=high&course=CSE101&category=Teaching&q=Updated",
    )
  ).json();
  expect(filtered.total).toBe(1);
  expect(
    (
      await page.request.post("/api/tasks", {
        data: { title: "bad", user_id: users[1].id },
      })
    ).status(),
  ).toBe(400);
  const other = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const signed = await other.auth.signInWithPassword({
    email: users[1].email,
    password: users[1].password,
  });
  expect(signed.error).toBeNull();
  const hidden = await other.from("tasks").select("*").eq("id", task.id);
  expect(hidden.data).toEqual([]);
  const update = await other
    .from("tasks")
    .update({ title: "intrusion" })
    .eq("id", task.id)
    .select();
  expect(update.data).toEqual([]);
  const remove = await other.from("tasks").delete().eq("id", task.id).select();
  expect(remove.data).toEqual([]);
  const insert = await other
    .from("tasks")
    .insert({ user_id: users[0].id, title: "intrusion" });
  expect(insert.error).not.toBeNull();
  await other.auth.signOut();
  await page.getByLabel("Search tasks").fill("");
  await page.reload();
  await page.screenshot({
    path: "test-results/tasks-desktop.png",
    fullPage: true,
  });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("button", { name: "Updated lecture plan", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
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
});
