import path from "node:path";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
test("quiz reveals source feedback only after answering and completes a scoped round", async ({ page }) => {
  test.slow();
  await signIn(page);
  await page.goto("/sources");
  await page.getByLabel("File").setInputFiles(path.join(__dirname, "fixtures", "quiz-garden.md"));
  await page.getByRole("button", { name: "Upload" }).click();
  await page.getByRole("button", { name: "Start extraction" }).click();
  await expect(page.getByTestId("extraction-status")).toContainText("Extraction complete", { timeout: 30000 });
  const sourceId = new URL(page.url()).pathname.split("/").pop()!;
  await page.goto("/review");
  await page.getByLabel("Filter by source").selectOption({ label: "quiz-garden" });
  const boxes = page.getByRole("list", { name: "Queue" }).getByRole("checkbox");
  const count = await boxes.count();
  expect(count).toBeGreaterThan(1);
  for (const box of await boxes.all()) await box.check();
  await page.getByRole("button", { name: "Approve selected" }).click();
  await expect(page.getByText("Nothing to review")).toBeVisible();
  await page.goto(`/quiz?source=${sourceId}`);
  await expect(page.getByRole("heading", { name: "Quick quiz" })).toBeVisible();
  for (let i = 0; i < count; i++) {
    await expect(page.getByRole("region", { name: "Answer feedback" })).toHaveCount(0);
    await page.getByRole("group", { name: "Answers" }).getByRole("button").first().click();
    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await expect(feedback.getByText("Source fact", { exact: true })).toBeVisible();
    await expect(feedback.locator("blockquote")).not.toBeEmpty();
    await expect(feedback.getByText("quiz-garden", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next question" }).click();
  }
  await expect(page.getByText("Round complete", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start another round" }).click();
  await expect(page.getByRole("article", { name: "Quiz question" })).toBeVisible();
});
