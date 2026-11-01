import { z } from "zod";

/**
 * Server environment, validated once at first use.
 * Values are never logged; only the names of missing or invalid keys are reported.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32, "must be at least 32 characters"),
    OWNER_PASSWORD: z.string().min(8, "must be at least 8 characters"),
    LLM_PROVIDER: z.enum(["gemini", "mock"]).default("gemini"),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.LLM_PROVIDER === "gemini") {
      if (!env.GEMINI_API_KEY) {
        ctx.addIssue({ code: "custom", path: ["GEMINI_API_KEY"], message: "required when LLM_PROVIDER=gemini" });
      }
      if (!env.GEMINI_MODEL) {
        ctx.addIssue({ code: "custom", path: ["GEMINI_MODEL"], message: "required when LLM_PROVIDER=gemini" });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  // Treat empty strings as unset so `KEY=` in an env file behaves like a missing key.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n  ${problems.join("\n  ")}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
