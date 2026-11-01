import { expect, type Page } from "@playwright/test";

export const OWNER_PASSWORD = process.env.OWNER_PASSWORD ?? "";

export async function signIn(page: Page): Promise<void> {
  expect(OWNER_PASSWORD, "OWNER_PASSWORD must be set for e2e tests").not.toBe("");
  await page.goto("/login");
  await page.getByLabel("Password").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
}
