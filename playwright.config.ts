import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

if (existsSync(".env.local")) config({ path: ".env.local", quiet: true });

const PORT = 3100;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
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
    reuseExistingServer: !isCI,
    timeout: 120_000,
    // The model is always mocked in end-to-end runs.
    env: { LLM_PROVIDER: "mock" },
  },
});
