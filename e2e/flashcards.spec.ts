import path from "node:path";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("flashcards from approved items, graded with SM-2 and saved", async ({ page }) => {
  // A long flow: upload, extraction and review come first.
  test.slow();
  await signIn(page);

  await page.goto("/sources");
  await page.getByLabel("File").setInputFiles(path.join(__dirname, "fixtures", "optionals.md"));
  await page.getByRole("button", { name: "Upload" }).click();
  await page.getByRole("button", { name: "Start extraction" }).click();
  await expect(page.getByTestId("extraction-status")).toContainText("Extraction complete", { timeout: 30_000 });

  await page.goto("/review");
  await page.getByLabel("Filter by source").selectOption({ label: "optionals" });
  const queue = page.getByRole("list", { name: "Queue" });
  await expect(queue.getByRole("checkbox")).toHaveCount(3);
  for (const box of await queue.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "Approve selected" }).click();
  await expect(page.getByText("Nothing to review")).toBeVisible();

  // Study only this source.
  await page.getByRole("link", { name: "Flashcards" }).click();
  await page.getByLabel("Study").selectOption({ label: "optionals" });
  await expect(page).toHaveURL(/\/flashcards\?source=/);
  const counts = page.getByTestId("flashcard-counts");
  await expect(counts).toHaveText("0 due · 3 new · 0 reviewed in the last 24 hours");

  // Question first; Space reveals the generated answer and the source fact.
  const card = page.getByRole("article", { name: "Flashcard" });
  await expect(card.getByText("New")).toBeVisible();
  await expect(card.getByText("Generated interpretation")).toBeVisible();
  await expect(card.getByRole("group", { name: "Grade" })).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(card.getByRole("region", { name: "Source facts" }).getByText("Source fact")).toBeVisible();
  await expect(card.getByRole("button", { name: "Again, next in 10m" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Good, next in 1d" })).toBeVisible();

  // Good with the keyboard, then Again with the mouse, then Easy.
  await page.keyboard.press("3");
  await expect(counts).toHaveText("0 due · 2 new · 1 reviewed in the last 24 hours");
  await card.getByRole("button", { name: "Show answer" }).click();
  await card.getByRole("button", { name: /^Again/ }).click();
  await expect(counts).toHaveText("0 due · 1 new · 2 reviewed in the last 24 hours");
  await page.keyboard.press("Space");
  await card.getByRole("button", { name: /^Easy/ }).click();

  // The Again card comes back in ten minutes; everything else is scheduled for later.
  await expect(page.getByText("All caught up")).toBeVisible();
  await expect(page.getByText("The next card is due in 10m.")).toBeVisible();
  await page.reload();
  await expect(counts).toHaveText("0 due · 0 new · 3 reviewed in the last 24 hours");
});
