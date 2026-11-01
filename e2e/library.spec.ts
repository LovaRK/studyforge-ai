import path from "node:path";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("approved items reach the library, grouped by type, with full-text search and filters", async ({ page }) => {
  // A long flow: upload, extraction and review come first.
  test.slow();
  await signIn(page);

  // Upload and extract a note with words no other test uses.
  await page.goto("/sources");
  await page.getByLabel("File").setInputFiles(path.join(__dirname, "fixtures", "secure-storage.md"));
  await page.getByRole("button", { name: "Upload" }).click();
  await page.getByRole("button", { name: "Start extraction" }).click();
  await expect(page.getByTestId("extraction-status")).toContainText("Extraction complete", { timeout: 30_000 });

  // Approve everything extracted from it.
  await page.goto("/review");
  await page.getByLabel("Filter by source").selectOption({ label: "secure-storage" });
  const boxes = page.getByRole("list", { name: "Queue" }).getByRole("checkbox");
  await expect(boxes).toHaveCount(3);
  for (const box of await boxes.all()) await box.check();
  await page.getByRole("button", { name: "Approve selected" }).click();
  await expect(page.getByText("Nothing to review")).toBeVisible();

  // Library: grouped by type, generated wording and source fact labelled.
  await page.getByRole("link", { name: "Library" }).click();
  await expect(page.getByRole("heading", { name: "Library", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Concept/, level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Term/, level: 2 })).toBeVisible();

  // A prefix search finds words in the verbatim excerpts and marks them.
  const search = page.getByLabel("Search the library");
  await search.fill("keych");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/library\?q=keych$/);
  await expect(page.getByRole("status")).toHaveText("2 matches for “keych”, best first");
  const first = page.getByRole("article").first();
  await expect(first.getByText("Generated interpretation")).toBeVisible();
  await expect(first.getByText("Source fact")).toBeVisible();
  await expect(first.getByTestId("library-snippet").locator("mark").first()).toHaveText("Keychain");

  // Every word must match.
  await search.fill("keychain preferences");
  await search.press("Enter");
  await expect(page.getByRole("status")).toHaveText("0 matches for “keychain preferences”, best first");
  await expect(page.getByText("Nothing matches")).toBeVisible();

  // Clear resets the form; a select applies on change.
  await page.getByRole("link", { name: "Clear" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(search).toHaveValue("");
  await page.getByLabel("Filter by source").selectOption({ label: "secure-storage" });
  await expect(page).toHaveURL(/source=/);
  await expect(page.getByRole("article")).toHaveCount(3);
  await page.getByLabel("Filter by type").selectOption("term");
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([/^Term/]);

  // A tag on a card filters the library by that tag.
  // Keyboard, because the dev server's fixed indicator can cover a link near the bottom edge.
  await page.getByRole("article").first().getByRole("link", { name: "demo" }).press("Enter");
  await expect(page).toHaveURL(/\/library\?tag=demo$/);
  await expect(page.getByLabel("Filter by tag")).toHaveValue("demo");
});
