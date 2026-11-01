import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { DEMO_NOTE } from "./note";

it("keeps the checked-in demo note and seeded text identical", () => {
  expect(readFileSync("demo/swift-value-semantics.md", "utf8").trim()).toBe(DEMO_NOTE);
});
