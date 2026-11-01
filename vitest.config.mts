import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolve = {
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    // `server-only` throws outside a React Server build; it is a no-op under test.
    "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
  },
};

export default defineConfig({
  resolve,
  test: {
    restoreMocks: true,
    projects: [
      {
        resolve,
        test: { name: "unit", environment: "node", include: ["src/**/*.test.ts"], exclude: ["src/**/*.int.test.ts"] },
      },
      {
        // Real Postgres: a separate `<db>_test` database, migrated before the run.
        resolve,
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts"],
          globalSetup: ["src/test/integration/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
    ],
  },
});
