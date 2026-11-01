import { container } from "@/server/container";

try {
  const source = await container().demo.load();
  console.log(`Demo ready: ${source.title}`);
  process.exit(0);
} catch (error) {
  console.error("Demo seed failed:", error instanceof Error ? error.message : "Unknown error");
  process.exit(1);
}
