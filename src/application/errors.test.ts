import { describe, expect, it } from "vitest";
import { isUserFacingError, UserFacingError } from "./errors";

describe("isUserFacingError", () => {
  it("recognises user-facing errors by their marker, not their class identity", () => {
    class Local extends UserFacingError {}
    expect(isUserFacingError(new Local("shown to the owner"))).toBe(true);
    // The same class loaded by another bundle layer is a different constructor with the same marker.
    expect(isUserFacingError(Object.assign(new Error("other copy"), { userFacing: true }))).toBe(true);
  });

  it("treats everything else as internal", () => {
    expect(isUserFacingError(new Error("database down"))).toBe(false);
    expect(isUserFacingError({ userFacing: true, message: "not an Error" })).toBe(false);
    expect(isUserFacingError("string")).toBe(false);
  });
});
