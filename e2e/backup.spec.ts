import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("backup is private and downloads a versioned study snapshot without credentials", async ({ browser, page }) => {
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.get("/api/backup");
  expect(denied.status()).toBe(401);
  await anonymous.close();

  await signIn(page);
  await page.goto("/dashboard");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download JSON backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^studyforge-backup-\d{4}-\d{2}-\d{2}\.json$/);

  const response = await page.request.get("/api/backup");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const backup = await response.json();
  expect(backup).toMatchObject({ product: "StudyForge AI", schemaVersion: 1 });
  expect(Object.keys(backup.data)).toContain("sources");
  expect(JSON.stringify(backup)).not.toContain("passwordHash");
  expect(JSON.stringify(backup)).not.toContain("ownerCredential");
  expect(JSON.stringify(backup)).not.toContain("llmCache");
});
