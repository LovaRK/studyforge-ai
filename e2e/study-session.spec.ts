import path from "node:path";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a focused study session over one source: timed, each card once, with a summary", async ({ page }) => {
  // A long flow: upload, extraction and review come first.
  test.slow();
  await signIn(page);

  await page.goto("/sources");
  await page.getByLabel("File").setInputFiles(path.join(__dirname, "fixtures", "error-handling.md"));
  await page.getByRole("button", { name: "Upload" }).click();
  await page.getByRole("button", { name: "Start extraction" }).click();
  await expect(page.getByTestId("extraction-status")).toContainText("Extraction complete", { timeout: 30_000 });

  await page.goto("/review");
  await page.getByLabel("Filter by source").selectOption({ label: "error-handling" });
  const queue = page.getByRole("list", { name: "Queue" });
  await expect(queue.getByRole("checkbox")).toHaveCount(3);
  for (const box of await queue.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "Approve selected" }).click();
  await expect(page.getByText("Nothing to review")).toBeVisible();

  // Start a 5-minute session on this source.
  await page.getByRole("link", { name: "Study", exact: true }).click();
  await page.getByLabel("What to study").selectOption({ label: "error-handling" });
  await page.getByText("5 min", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "5 min", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/study\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("timer", { name: "Time left" })).toHaveText(/^[45]:\d\d$/);
  const progress = page.getByTestId("session-progress");
  await expect(progress).toHaveText("Source: error-handling · 0 done");

  // Grade one card, then finish early.
  await page.keyboard.press("Space");
  await page.keyboard.press("3");
  await expect(progress).toHaveText("Source: error-handling · 1 done");
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("heading", { name: "Session finished" })).toBeVisible();
  await expect(page.getByLabel("Session summary")).toContainText("Studied1");
  await expect(page.getByLabel("Session summary")).toContainText("Good1");

  // A second session shows only the two cards not yet studied, then ends by itself.
  await page.getByRole("link", { name: "Start another session" }).click();
  await page.getByLabel("What to study").selectOption({ label: "error-handling" });
  await page.getByRole("button", { name: "Start session" }).click();
  for (const done of [0, 1]) {
    await expect(progress).toHaveText(`Source: error-handling · ${done} done`);
    await page.getByRole("button", { name: "Show answer" }).click();
    await page.getByRole("button", { name: /^Easy/ }).click();
  }
  await expect(page.getByRole("heading", { name: "Nothing left to study here" })).toBeVisible();
  await expect(page.getByLabel("Session summary")).toContainText("Studied2");
  await expect(page.getByLabel("Session summary")).toContainText("Easy2");
});
