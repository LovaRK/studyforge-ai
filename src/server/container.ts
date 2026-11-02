import "server-only";
import { makeBackup } from "@/application/backup/export-backup";
import { makeDemoLoader } from "@/application/demo/load-demo";
import { DEMO_NOTE } from "@/application/demo/note";
import { makeDashboard } from "@/application/dashboard/dashboard";
import { DrizzleDashboardStore } from "@/infrastructure/repositories/drizzle-dashboard-store";
import { makeQuiz } from "@/application/quiz/quiz";
import { DrizzleQuizStore } from "@/infrastructure/repositories/drizzle-quiz-store";
import { makeLogin } from "@/application/auth/login";
import { ensureOwnerCredential } from "@/application/auth/owner-credential";
import { ExtractionRunner } from "@/application/extraction/extraction-runner";
import { makeFlashcards } from "@/application/flashcards/flashcards";
import { makeConceptPages } from "@/application/library/concept-page";
import { makeLibrary } from "@/application/library/library";
import { makeReview } from "@/application/review/review";
import { makeStudySessions } from "@/application/study-session/study-session";
import { getEnv } from "@/config/env";
import { DrizzleOwnerCredentialStore } from "@/infrastructure/auth/drizzle-owner-credential-store";
import { MemoryLoginRateLimiter } from "@/infrastructure/auth/memory-rate-limiter";
import { ScryptPasswordHasher } from "@/infrastructure/auth/scrypt-password-hasher";
import { HmacSessionIssuer } from "@/infrastructure/auth/session-token";
import { getDb } from "@/infrastructure/db/client";
import { createLlmProvider } from "@/infrastructure/llm/factory";
import { demoResponder } from "@/infrastructure/llm/demo-responder";
import { MockLlmProvider } from "@/infrastructure/llm/mock-provider";
import { logger } from "@/infrastructure/logging/logger";
import { DrizzleBackupStore } from "@/infrastructure/repositories/drizzle-backup-store";
import { DrizzleDemoStore } from "@/infrastructure/repositories/drizzle-demo-store";
import { DrizzleExtractionStore, DrizzleLlmCache } from "@/infrastructure/repositories/drizzle-extraction-store";
import { DrizzleLibraryStore } from "@/infrastructure/repositories/drizzle-library-store";
import { DrizzleReviewStore } from "@/infrastructure/repositories/drizzle-review-store";
import { DrizzleSourceStore } from "@/infrastructure/repositories/drizzle-source-store";
import { DrizzleSrsStore } from "@/infrastructure/repositories/drizzle-srs-store";
import { DrizzleStudySessionStore } from "@/infrastructure/repositories/drizzle-study-session-store";
import { DocumentTextExtractor } from "@/infrastructure/text/document-text-extractor";

/** Composition root: the only place that wires infrastructure into use cases. */
function build() {
  const env = getEnv();
  const db = getDb(env.DATABASE_URL);
  const store = new DrizzleOwnerCredentialStore(db);
  const hasher = new ScryptPasswordHasher();
  const credentialDeps = { store, hasher, ownerPassword: env.OWNER_PASSWORD };

  const llm = createLlmProvider(env);
  const sources = new DrizzleSourceStore(db);
  const extraction = new DrizzleExtractionStore(db);
  const reviewStore = new DrizzleReviewStore(db);
  const libraryStore = new DrizzleLibraryStore(db);
  const flashcards = makeFlashcards({ store: new DrizzleSrsStore(db), items: reviewStore });
  const demoExtraction = new ExtractionRunner({
    sources,
    store: extraction,
    cache: new DrizzleLlmCache(db),
    llm: new MockLlmProvider(demoResponder),
    model: "mock",
    logger: logger.child({ component: "demo-extraction" }),
    options: { requestsPerMinute: 0 },
  });

  return {
    env,
    db,
    llm,
    sources,
    extraction,
    reviewStore,
    review: makeReview(reviewStore),
    library: makeLibrary(libraryStore),
    conceptPages: makeConceptPages({ items: reviewStore, sources, library: libraryStore }),
    flashcards,
    studySessions: makeStudySessions({ store: new DrizzleStudySessionStore(db), flashcards }),
    dashboard: makeDashboard(new DrizzleDashboardStore(db)),
    backup: makeBackup(new DrizzleBackupStore(db)),
    demo: makeDemoLoader({ store: new DrizzleDemoStore(db), extraction: demoExtraction, note: DEMO_NOTE }),
    quiz: makeQuiz({ store: new DrizzleQuizStore(db) }),
    textExtractor: new DocumentTextExtractor(),
    extractionRunner: new ExtractionRunner({
      sources,
      store: extraction,
      cache: new DrizzleLlmCache(db),
      llm,
      model: env.LLM_PROVIDER === "gemini" ? env.GEMINI_MODEL! : "mock",
      logger: logger.child({ component: "extraction" }),
      options: { requestsPerMinute: env.LLM_REQUESTS_PER_MINUTE ?? (env.LLM_PROVIDER === "mock" ? 0 : 10) },
    }),
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
