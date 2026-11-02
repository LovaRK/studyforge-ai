import { existsSync } from "node:fs";
import { config } from "dotenv";

if (existsSync(".env.local")) config({ path: ".env.local", quiet: true });

async function main() {
  const { container } = await import("@/server/container");
  const source = await container().demo.load();
  console.log(`Demo ready: ${source.title}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Demo seed failed:", error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  });
