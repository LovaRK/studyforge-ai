import "server-only";
import { makeLogin } from "@/application/auth/login";
import { ensureOwnerCredential } from "@/application/auth/owner-credential";
import { getEnv } from "@/config/env";
import { DrizzleOwnerCredentialStore } from "@/infrastructure/auth/drizzle-owner-credential-store";
import { MemoryLoginRateLimiter } from "@/infrastructure/auth/memory-rate-limiter";
import { ScryptPasswordHasher } from "@/infrastructure/auth/scrypt-password-hasher";
import { HmacSessionIssuer } from "@/infrastructure/auth/session-token";
import { getDb } from "@/infrastructure/db/client";
import { createLlmProvider } from "@/infrastructure/llm/factory";

/** Composition root: the only place that wires infrastructure into use cases. */
function build() {
  const env = getEnv();
  const db = getDb(env.DATABASE_URL);
  const store = new DrizzleOwnerCredentialStore(db);
  const hasher = new ScryptPasswordHasher();
  const credentialDeps = { store, hasher, ownerPassword: env.OWNER_PASSWORD };

  return {
    env,
    db,
    llm: createLlmProvider(env),
    ensureOwnerCredential: () => ensureOwnerCredential(credentialDeps),
    login: makeLogin({
      ...credentialDeps,
      sessions: new HmacSessionIssuer(env.SESSION_SECRET),
      limiter: new MemoryLoginRateLimiter(),
    }),
  };
}

type Container = ReturnType<typeof build>;
const globalForContainer = globalThis as unknown as { studyforgeContainer?: Container };

export function container(): Container {
  globalForContainer.studyforgeContainer ??= build();
  return globalForContainer.studyforgeContainer;
}
