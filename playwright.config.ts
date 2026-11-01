import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { e2eDatabaseUrl } from "./e2e/database-url";

if (existsSync(".env.local")) config({ path: ".env.local", quiet: true });

// Override per worktree so two workers can run e2e at the same time.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI tests the production build; locally the dev server is quicker to iterate on.
    command: isCI ? `npm run start -- --port ${PORT}` : `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Own database, and the model is always mocked.
    env: { DATABASE_URL: e2eDatabaseUrl(), LLM_PROVIDER: "mock" },
  },
});
