import path from "node:path";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("concept pages and how-to guides link every source fact back to its document", async ({ page }) => {
  // A long flow: upload, extraction and review come first.
  test.slow();
  await signIn(page);

  await page.goto("/sources");
  await page.getByLabel("File").setInputFiles(path.join(__dirname, "fixtures", "shipping-a-build.md"));
  await page.getByLabel(/Attribution/).fill("Release test note");
  await page.getByRole("button", { name: "Upload" }).click();
  await page.getByRole("button", { name: "Start extraction" }).click();
  await expect(page.getByTestId("extraction-status")).toContainText("Extraction complete", { timeout: 30_000 });

  // In review: turn one item into a how-to with listed steps, tag two items alike, approve all three.
  await page.goto("/review");
  await page.getByLabel("Filter by source").selectOption({ label: "shipping-a-build" });
  const queue = page.getByRole("list", { name: "Queue" });
  const item = page.getByRole("article", { name: "Item" });
  await queue.getByRole("button", { name: /Shipping a build/ }).click();
  await expect(item.getByRole("heading", { name: "# Shipping a build Archive" })).toBeVisible();
  await item.getByRole("button", { name: "Edit" }).click();
  await item.getByLabel("Type").selectOption("how_to");
  await item.getByLabel("Title").fill("Ship a build to testers");
  await item
    .getByLabel("Answer")
    .fill("1. Archive the app in Xcode.\n2. Upload it to App Store Connect.\n3. Invite testers in TestFlight.");
  await item.getByRole("button", { name: "Save" }).click();
  await expect(item.getByRole("heading", { name: "Ship a build to testers" })).toBeVisible();
  await item.getByLabel("Add tag").fill("release");
  await item.getByLabel("Add tag").press("Enter");
  await expect(item.getByRole("button", { name: "Remove tag release" })).toBeVisible();
  await queue.getByRole("button", { name: /TestFlight lets invited/ }).click();
  await expect(item.getByRole("heading", { name: "TestFlight lets invited testers install" })).toBeVisible();
  await item.getByLabel("Add tag").fill("release");
  await item.getByLabel("Add tag").press("Enter");
  await expect(item.getByRole("button", { name: "Remove tag release" })).toBeVisible();
  for (const box of await queue.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "Approve selected" }).click();
  await expect(page.getByText("Nothing to review")).toBeVisible();

  // The how-to guide: generated steps labelled, the source fact verbatim in its context.
  await page.goto("/library?q=testers");
  await page.getByRole("link", { name: "Ship a build to testers" }).click();
  await expect(page.getByRole("heading", { name: "Ship a build to testers", level: 1 })).toBeVisible();
  await expect(page.getByText("How-to guide")).toBeVisible();
  const steps = page.getByRole("region", { name: "Steps" });
  await expect(steps.getByText("Generated interpretation")).toBeVisible();
  await expect(steps.getByRole("listitem")).toHaveText([
    "Archive the app in Xcode.",
    "Upload it to App Store Connect.",
    "Invite testers in TestFlight.",
  ]);
  const fact = page.getByTestId("source-fact");
  await expect(fact).toHaveCount(1);
  await expect(fact.getByText("Source fact")).toBeVisible();
  await expect(fact.getByTestId("source-fact-source")).toHaveText("shipping-a-build · Source: Release test note");
  const quote = (await fact.getByTestId("source-fact-quote").textContent())!;
  expect(quote).toContain("Archive the app in Xcode before you upload it to App Store Connect.");

  // Related: the item sharing the "release" tag comes first.
  const related = page.getByRole("region", { name: "Related" }).getByRole("link");
  await expect(related.first()).toContainText("TestFlight lets invited");

  // "Open in source" lands on the same span, highlighted in the full text.
  await fact.getByRole("link", { name: "Open in source" }).click();
  await expect(page).toHaveURL(/\/sources\/[0-9a-f-]+\?at=\d+-\d+#excerpt$/);
  await expect(page.getByTestId("source-highlight")).toHaveText(quote);
  await expect(page.getByTestId("source-highlight")).toBeInViewport();

  // A concept page (no steps) offers its generated question with the answer hidden.
  await page.goBack();
  await related.first().click();
  const check = page.getByRole("region", { name: "Check yourself" });
  await expect(check.getByText("Generated interpretation")).toBeVisible();
  await expect(check.getByText("Show answer")).toBeVisible();

  // Unknown ids are a 404, not an error.
  const response = await page.goto("/library/00000000-0000-4000-8000-000000000000");
  expect(response?.status()).toBe(404);
});
