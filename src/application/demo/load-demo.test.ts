import { expect, it, vi } from "vitest";
import type { DemoStore } from "@/application/ports/demo";
import { makeDemoLoader } from "./load-demo";

it("stores the original note once and waits for mock extraction", async () => {
  const source = {
    id: "source",
    title: "Demo",
    attribution: null,
    fileName: "demo.md",
    mimeType: "text/markdown",
    text: "text",
    wordCount: 1,
    createdAt: new Date(),
  };
  const store: DemoStore = { ensureSource: vi.fn(async () => source) };
  const extraction = { start: vi.fn(() => true), whenIdle: vi.fn(async () => {}) };
  const demo = makeDemoLoader({ store, extraction, note: "# Heading\n\nThis original sentence has enough words to become a study item." });

  await expect(demo.load()).resolves.toBe(source);
  expect(store.ensureSource).toHaveBeenCalledOnce();
  expect(extraction.start).toHaveBeenCalledWith("source");
  expect(extraction.whenIdle).toHaveBeenCalledWith("source");
});
