import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/studyforge",
  SESSION_SECRET: "x".repeat(32),
  OWNER_PASSWORD: "long-enough",
};

describe("parseEnv", () => {
  it("accepts a mock-provider configuration", () => {
    expect(parseEnv({ ...base, LLM_PROVIDER: "mock" }).LLM_PROVIDER).toBe("mock");
  });

  it("requires a key and model for Gemini, treating empty values as missing", () => {
    expect(() => parseEnv({ ...base, LLM_PROVIDER: "gemini", GEMINI_API_KEY: "k", GEMINI_MODEL: "" })).toThrow(/GEMINI_MODEL/);
  });

  it("names invalid keys without echoing their values", () => {
    const attempt = () => parseEnv({ ...base, LLM_PROVIDER: "mock", SESSION_SECRET: "short-secret-value" });
    expect(attempt).toThrow(/SESSION_SECRET/);
    expect(attempt).not.toThrow(/short-secret-value/);
  });

  it("rejects unverified trusted proxy hops", () => {
    expect(() => parseEnv({ ...base, LLM_PROVIDER: "mock", TRUSTED_PROXY_HOPS: "1" })).toThrow(/TRUSTED_PROXY_HOPS_VERIFIED/);
    expect(() => parseEnv({ ...base, LLM_PROVIDER: "mock", TRUSTED_PROXY_HOPS: "1", TRUSTED_PROXY_HOPS_VERIFIED: "true" })).toThrow(
      /append-only/,
    );
  });
});
