import { test, expect } from "@playwright/test";
test("unauthenticated users cannot access task data", async ({ request }) => {
  for (const path of [
    "/api/tasks",
    "/api/dashboard",
    "/api/tasks/00000000-0000-4000-8000-000000000000",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
  }
  expect(
    (
      await request.post("/api/tasks", { data: { title: "unauthorized" } })
    ).status(),
  ).toBe(401);
});
test("login is usable on mobile and protected pages redirect", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByLabel("Full name")).toBeVisible();
});
