import { afterAll, beforeEach, expect, it } from "vitest";
import { sources } from "@/infrastructure/db/schema";
import { connect, truncateAll } from "@/test/integration/database";
import { DrizzleDemoStore } from "./drizzle-demo-store";

const { client, db } = connect();
const store = new DrizzleDemoStore(db);

beforeEach(() => truncateAll(db));
afterAll(() => client.end());

it("creates one demo source under concurrent loads", async () => {
  const source = {
    title: "Demo",
    attribution: "Original",
    fileName: "studyforge-demo-swift.md",
    mimeType: "text/markdown",
    text: "An original demo sentence.",
    wordCount: 4,
  };
  const chunks = [{ ordinal: 0, heading: null, start: 0, end: source.text.length, wordCount: 4 }];
  const results = await Promise.all(Array.from({ length: 5 }, () => store.ensureSource(source, chunks)));

  expect(new Set(results.map((result) => result.id))).toHaveLength(1);
  expect(await db.select().from(sources)).toHaveLength(1);
});

it("does not mistake an unrelated upload with the same filename for the demo", async () => {
  const shared = { title: "Demo", attribution: "Original", fileName: "studyforge-demo-swift.md", mimeType: "text/markdown", wordCount: 4 };
  await store.ensureSource({ ...shared, text: "An unrelated owner upload." }, [
    { ordinal: 0, heading: null, start: 0, end: 26, wordCount: 4 },
  ]);
  const demo = await store.ensureSource({ ...shared, text: "The original demo note." }, [
    { ordinal: 0, heading: null, start: 0, end: 23, wordCount: 4 },
  ]);

  expect(demo.text).toBe("The original demo note.");
  expect(await db.select().from(sources)).toHaveLength(2);
});
