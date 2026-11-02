import type { DemoExtraction, DemoStore } from "@/application/ports/demo";
import { cleanSourceText } from "@/application/sources/import-source";
import { chunkText, countWords } from "@/domain/text/chunker";

export const DEMO_FILE_NAME = "studyforge-demo-swift.md";

export function makeDemoLoader({ store, extraction, note }: { store: DemoStore; extraction: DemoExtraction; note: string }) {
  return {
    async load() {
      const text = cleanSourceText(note);
      const source = await store.ensureSource(
        {
          title: "Swift value and reference semantics",
          attribution: "Original StudyForge demo note",
          fileName: DEMO_FILE_NAME,
          mimeType: "text/markdown",
          text,
          wordCount: countWords(text),
        },
        chunkText(text, { maxWords: 1500 }).map(({ ordinal, heading, start, end, wordCount }) => ({
          ordinal,
          heading,
          start,
          end,
          wordCount,
        })),
      );
      extraction.start(source.id);
      await extraction.whenIdle(source.id);
      return source;
    },
  };
}

export type DemoLoader = ReturnType<typeof makeDemoLoader>;
