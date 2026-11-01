import { z } from "zod";
import type { StudyScope } from "@/application/ports/flashcards";

const params = z.object({
  tag: z.string().trim().min(1).max(40).optional().catch(undefined),
  source: z.string().uuid().optional().catch(undefined),
});

/** Reads `?tag=` or `?source=` (source wins) into a study scope; anything else means everything. */
export function parseStudyScope(searchParams: Record<string, string | string[] | undefined>): StudyScope {
  const { tag, source } = params.parse(searchParams);
  if (source) return { scope: "source", value: source };
  if (tag) return { scope: "tag", value: tag };
  return { scope: "all" };
}
