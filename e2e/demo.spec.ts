import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("loads the original demo once through extraction and leaves every verified item for review", async ({ page }) => {
  test.slow();
  await signIn(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Load original demo note" }).click();
  await expect(page).toHaveURL(/\/sources\/[0-9a-f-]+$/);
  await expect(page.getByTestId("extraction-status")).toContainText("Extraction complete", { timeout: 30_000 });
  await expect(page.getByText(/Rejected: excerpt not found/)).toBeVisible();
  const firstUrl = page.url();

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Load original demo note" }).click();
  await expect(page).toHaveURL(firstUrl);

  await page.goto("/review");
  await page.getByLabel("Filter by source").selectOption({ label: "Swift value and reference semantics" });
  await expect(page.getByRole("list", { name: "Queue" }).getByRole("checkbox")).toHaveCount(4);
});
