import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
test("dashboard explains its measurements and fits a narrow screen in both themes", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Small sessions/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Review decisions" })).toBeVisible();
  await page.getByText("How these numbers work", { exact: true }).click();
  await expect(page.getByText(/Mastery is a study signal/)).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("link", { name: /Study .* due cards?/ })).toBeVisible();
  }
  await page.getByRole("link", { name: "Take a quick quiz" }).click();
  await expect(page.getByRole("heading", { name: "Quick quiz" })).toBeVisible();
});
