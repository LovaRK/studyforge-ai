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

  // Grade one card, then finish the session from a second tab.
  await page.keyboard.press("Space");
  await page.keyboard.press("3");
  await expect(progress).toHaveText("Source: error-handling · 1 done");
  const other = await page.context().newPage();
  await other.goto(page.url());
  await other.getByRole("button", { name: "Finish" }).click();
  await expect(other.getByRole("heading", { name: "Session finished" })).toBeVisible();
  await other.close();

  // The first tab's late answer (now a quiz question) is refused, and Continue shows the unchanged summary.
  const answers = page.getByRole("group", { name: "Answers" });
  await answers.getByRole("button").first().click();
  await expect(page.getByRole("alert").filter({ hasText: "session has ended" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Session finished" })).toBeVisible();
  await expect(page.getByLabel("Session summary")).toContainText("Studied1");
  await expect(page.getByLabel("Session summary")).toContainText("Good1");

  // A late flashcard grade is refused the same way.
  await page.getByRole("link", { name: "Start another session" }).click();
  await page.getByLabel("What to study").selectOption({ label: "error-handling" });
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(progress).toHaveText("Source: error-handling · 0 done");
  const cardTab = await page.context().newPage();
  await cardTab.goto(page.url());
  await cardTab.getByRole("button", { name: "Finish" }).click();
  await expect(cardTab.getByRole("heading", { name: "Session finished" })).toBeVisible();
  await cardTab.close();
  await page.getByRole("button", { name: "Show answer" }).click();
  await page.getByRole("button", { name: /^Good/ }).click();
  await expect(page.getByRole("heading", { name: "Session finished" })).toBeVisible();
  await expect(page.getByLabel("Session summary")).toContainText("Studied0");

  // A third session alternates new cards and quiz questions until nothing is left.
  await page.getByRole("link", { name: "Start another session" }).click();
  await page.getByLabel("What to study").selectOption({ label: "error-handling" });
  await page.getByRole("button", { name: "Start session" }).click();
  const kinds: string[] = [];
  let correct = 0;
  const nothingLeft = page.getByRole("heading", { name: "Nothing left to study here" });
  for (let done = 0; done < 4; done++) {
    // Wait for this step's page: the next progress count, or the summary once nothing is left.
    await expect(progress.filter({ hasText: ` ${done} done` }).or(nothingLeft)).toBeVisible();
    if (await nothingLeft.isVisible()) break;
    if (await answers.isVisible()) {
      kinds.push("quiz");
      await answers.getByRole("button").first().click();
      // Feedback shows the source fact before moving on.
      const feedback = page.getByRole("region", { name: "Answer feedback" });
      await expect(feedback.getByText("Source fact", { exact: true })).toBeVisible();
      if ((await feedback.getByRole("status").innerText()) === "Correct") correct++;
      await page.getByRole("button", { name: "Next question" }).click();
    } else {
      kinds.push("card");
      await page.getByRole("button", { name: "Show answer" }).click();
      await page.getByRole("button", { name: /^Easy/ }).click();
    }
  }
  await expect(nothingLeft).toBeVisible();
  expect(kinds.slice(0, 2)).toEqual(["card", "quiz"]);
  const summary = page.getByLabel("Session summary");
  await expect(summary).toContainText(`Studied${kinds.length}`);
  await expect(summary).toContainText(`Quiz correct${correct}/${kinds.filter((k) => k === "quiz").length}`);
  await expect(summary).toContainText(`Easy${kinds.filter((k) => k === "card").length}`);
});
