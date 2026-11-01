import { describe, expect, it } from "vitest";
import { headlineSegments } from "./drizzle-library-store";

describe("headlineSegments", () => {
  it("splits ts_headline output into plain and matched runs", () => {
    expect(headlineSegments("Grand \u0002Central\u0003 runs \u0002queues\u0003.")).toEqual([
      { text: "Grand ", match: false },
      { text: "Central", match: true },
      { text: " runs ", match: false },
      { text: "queues", match: true },
      { text: ".", match: false },
    ]);
  });

  it("returns plain text unchanged and nothing for an empty headline", () => {
    expect(headlineSegments("No match here.")).toEqual([{ text: "No match here.", match: false }]);
    expect(headlineSegments("")).toEqual([]);
  });
});
