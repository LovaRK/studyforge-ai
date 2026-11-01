import { describe, expect, it } from "vitest";
import { parseStudyScope } from "./study-scope";

const ID = "6f1c2c1e-2d0a-4b7f-9a55-0d6f5c3b8e11";

describe("parseStudyScope", () => {
  it("reads a source or a tag, preferring the source", () => {
    expect(parseStudyScope({ source: ID })).toEqual({ scope: "source", value: ID });
    expect(parseStudyScope({ tag: "swift" })).toEqual({ scope: "tag", value: "swift" });
    expect(parseStudyScope({ tag: "swift", source: ID })).toEqual({ scope: "source", value: ID });
  });

  it("falls back to everything for missing or invalid values", () => {
    expect(parseStudyScope({})).toEqual({ scope: "all" });
    expect(parseStudyScope({ source: "not-a-uuid", tag: "" })).toEqual({ scope: "all" });
    expect(parseStudyScope({ tag: ["a", "b"] })).toEqual({ scope: "all" });
  });
});
