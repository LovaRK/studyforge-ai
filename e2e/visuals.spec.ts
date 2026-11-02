import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// The demo is approved and studied in place, so a retry would find an empty queue.
// Regenerate the images by running this spec alone against a fresh e2e database.
test.describe.configure({ retries: 0 });

test("capture public demo review and dashboard visuals", async ({ page }, testInfo) => {
  test.slow();
  await page.setViewportSize({ width: 1200, height: 800 });
  // Reduced motion: capture the settled page, not its entrance animation.
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await signIn(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Load original demo note" }).click();
  await expect(page.getByTestId("extraction-status")).toContainText("Extraction complete", { timeout: 30_000 });
  const sourceId = new URL(page.url()).pathname.split("/").pop()!;

  await page.goto("/review");
  await page.getByLabel("Filter by source").selectOption({ label: "Swift value and reference semantics" });
  // Wait for the filtered queue, so the checkboxes below are the demo's own.
  await expect(page).toHaveURL(new RegExp(`source=${sourceId}`));
  const queue = page.getByRole("list", { name: "Queue" });
  await expect(queue.getByRole("checkbox")).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath("review-demo.png"), fullPage: true });

  for (const checkbox of await queue.getByRole("checkbox").all()) await checkbox.check();
  await page.getByRole("button", { name: "Approve selected" }).click();
  await expect(page.getByText("Nothing to review")).toBeVisible();

  // Study the demo once, so the cover shows real progress rather than empty tiles:
  // grade every card Good, remembering each answer, then take a quiz round.
  const answers = new Map<string, string>();
  await page.goto(`/flashcards?source=${sourceId}`);
  const card = page.getByRole("article", { name: "Flashcard" });
  for (let i = 0; i < 4; i++) {
    const question = (await card.getByRole("heading").innerText()).trim();
    await card.getByRole("button", { name: "Show answer" }).click();
    answers.set(question, (await card.getByRole("region", { name: "Answer" }).locator("p").innerText()).trim());
    await card.getByRole("button", { name: /^Good/ }).click();
    if (i < 3) await expect(card.getByRole("heading")).not.toHaveText(question);
  }
  await expect(page.getByText("All caught up")).toBeVisible();

  await page.goto(`/quiz?source=${sourceId}`);
  const feedback = page.getByRole("region", { name: "Answer feedback" });
  for (let i = 0; i < 4; i++) {
    // The next question has loaded once the previous feedback is gone.
    await expect(feedback).toHaveCount(0);
    const quiz = page.getByRole("article", { name: "Quiz question" });
    const answer = answers.get((await quiz.getByRole("heading").innerText()).trim())!;
    await quiz.getByRole("group", { name: "Answers" }).getByRole("button").filter({ hasText: answer }).click();
    await expect(feedback.getByRole("status")).toHaveText("Correct");
    await page.getByRole("button", { name: "Next question" }).click();
  }
  await expect(page.getByText("Round complete", { exact: true })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText("1 day", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Swift value and reference semantics established" })).toHaveAttribute("max", "4");
  // Handshake requires a 3:2 dashboard cover at least 1,200 px wide.
  await page.screenshot({ path: testInfo.outputPath("dashboard-demo.png") });
});
