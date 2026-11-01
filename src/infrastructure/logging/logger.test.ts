import { describe, expect, it } from "vitest";
import { createLogger, redact } from "./logger";

describe("logger", () => {
  it("redacts sensitive keys at any depth", () => {
    expect(redact({ password: "p", nested: { apiKey: "k", ok: 1 }, list: [{ token: "t" }] })).toEqual({
      password: "[redacted]",
      nested: { apiKey: "[redacted]", ok: 1 },
      list: [{ token: "[redacted]" }],
    });
  });

  it("writes one JSON line per entry with bindings", () => {
    const lines: string[] = [];
    createLogger({ app: "test" }, (line) => lines.push(line))
      .child({ requestId: "r1" })
      .info("hello", { sessionSecret: "s", count: 2 });

    const entry = JSON.parse(lines[0]!);
    expect(entry).toMatchObject({ level: "info", message: "hello", app: "test", requestId: "r1", count: 2, sessionSecret: "[redacted]" });
  });
});
