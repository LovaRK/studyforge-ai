import { expect, test } from "@playwright/test";

const password = process.env.OWNER_PASSWORD ?? "";

test.describe("privacy and login", () => {
  test.beforeAll(() => {
    expect(password, "OWNER_PASSWORD must be set for e2e tests").not.toBe("");
  });

  test("signed-out visitors only ever see the login screen", async ({ page, request }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "StudyForge AI" })).toBeVisible();

    const api = await request.get("/api/health");
    expect(api.status()).toBe(401);
  });

  test("a wrong password is rejected", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    // Next.js renders its own (empty) role="alert" route announcer, so filter by text.
    await expect(page.getByRole("alert").filter({ hasText: "That password is not correct." })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the owner can sign in, reach the API and sign out", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    const health = await page.request.get("/api/health");
    expect(await health.json()).toEqual({ status: "ok" });

    const cookie = (await page.context().cookies()).find((c) => c.name === "sf_session");
    expect(cookie?.httpOnly).toBe(true);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});
