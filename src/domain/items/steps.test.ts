import { describe, expect, it } from "vitest";
import { splitSteps } from "./steps";

describe("splitSteps", () => {
  it("reads numbered, 'Step n' and bulleted lists", () => {
    expect(splitSteps("1. Open the project.\n2) Add the package.\n3: Build.")).toEqual(["Open the project.", "Add the package.", "Build."]);
    expect(splitSteps("Step 1: Archive\nStep 2: Upload")).toEqual(["Archive", "Upload"]);
    expect(splitSteps("- Lock\n* Write\n• Unlock")).toEqual(["Lock", "Write", "Unlock"]);
  });

  it("joins wrapped lines to the step they continue and skips blank lines", () => {
    expect(splitSteps("1. Create a queue\n   with a label.\n\n2. Dispatch work to it.")).toEqual([
      "Create a queue with a label.",
      "Dispatch work to it.",
    ]);
  });

  it("returns null for prose, a single step, or text that starts with an introduction", () => {
    expect(splitSteps("Call the API, then read the result.")).toBeNull();
    expect(splitSteps("1. Only one step.")).toBeNull();
    expect(splitSteps("To ship:\n1. Archive\n2. Upload")).toBeNull();
    expect(splitSteps("")).toBeNull();
  });

  it("does not mistake a number inside a sentence for a step", () => {
    expect(splitSteps("Swift 5.9 added macros.\nThey run at compile time.")).toBeNull();
  });
});
