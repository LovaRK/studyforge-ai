import path from "node:path";
import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { signIn } from "./helpers";

const FIXTURE = path.join(__dirname, "fixtures", "value-and-reference-types.md");
const waiting = (n: number) => new RegExp(`^${n} items? waiting`);

test("upload → extraction → word-for-word check → review queue", async ({ page }) => {
  await signIn(page);

  // Upload
  await page.getByRole("link", { name: "Sources" }).click();
  await page.getByLabel("File").setInputFiles(FIXTURE);
  await page.getByLabel(/Attribution/).fill("Written for the StudyForge tests");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("heading", { name: "value-and-reference-types" })).toBeVisible();
  await expect(page.getByText("Source: Written for the StudyForge tests")).toBeVisible();

  // Extraction (mock model): real quotes pass, the invented one is rejected.
  await page.getByRole("button", { name: "Start extraction" }).click();
  await expect(page.getByTestId("extraction-status")).toContainText("Extraction complete", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /Rejected: excerpt not found/ })).toContainText("(1)");
  await expect(page.getByText("This sentence was invented by the model")).toBeVisible();

  // Review queue: item beside its highlighted source excerpt.
  await page.getByRole("link", { name: /Review \d+ items?/ }).click();
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  const status = page.getByText(/\d+ items? waiting/);
  const count = async () => Number((await status.textContent())!.match(/(\d+) item/)![1]);
  const initial = await count();
  expect(initial).toBeGreaterThanOrEqual(4);

  const item = page.getByRole("article", { name: "Item" });
  await expect(item.getByText("Generated interpretation")).toBeVisible();
  await expect(item.getByText("Source fact")).toBeVisible();
  const quote = (await item.locator("blockquote").first().textContent())!.trim();
  await expect(page.getByTestId("source-highlight").first()).toHaveText(quote);

  // Approve with the keyboard shortcut.
  await page.keyboard.press("a");
  await expect(status).toHaveText(waiting(initial - 1));

  // Edit inline.
  await item.getByRole("button", { name: "Edit" }).click();
  await item.getByLabel("Title").fill("Value types keep their own copy");
  await item.getByRole("button", { name: "Save" }).click();
  await expect(item.getByRole("heading", { name: "Value types keep their own copy" })).toBeVisible();
  await expect(item.getByText("Edited")).toBeVisible();

  // Tag.
  await item.getByLabel("Add tag").fill("Swift Basics");
  await item.getByLabel("Add tag").press("Enter");
  await expect(item.getByText("swift-basics")).toBeVisible();

  // Merge two items; the result keeps both excerpts.
  const checkboxes = page.getByRole("list", { name: "Queue" }).getByRole("checkbox");
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await page.getByRole("button", { name: "Merge selected" }).click();
  await expect(item.getByText("Merged · 2 excerpts")).toBeVisible();
  await expect(item.locator("blockquote")).toHaveCount(2);
  await expect(status).toHaveText(waiting(initial - 2));

  // Discard.
  await item.getByRole("button", { name: "Discard" }).click();
  await expect(status).toHaveText(waiting(initial - 3));

  // Decisions persist across a reload.
  await page.reload();
  await expect(status).toHaveText(waiting(initial - 3));
});

test("a PDF upload is turned into text on the server", async ({ page }) => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([400, 200]).drawText("Optionals model a value that may be absent.", { x: 30, y: 120, size: 12, font });

  await signIn(page);
  await page.goto("/sources");
  await page
    .getByLabel("File")
    .setInputFiles({ name: "optionals.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("heading", { name: "optionals" })).toBeVisible();
  await page.getByText("Extracted text").click();
  await expect(page.getByText("Optionals model a value that may be absent.")).toBeVisible();
});

test("upload rejects unsupported files", async ({ page }) => {
  await signIn(page);
  await page.goto("/sources");
  await page
    .getByLabel("File")
    .setInputFiles({ name: "slides.pptx", mimeType: "application/octet-stream", buffer: Buffer.from("not text") });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Upload a PDF" })).toBeVisible();
});
