import type { Metadata } from "next";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";
import { ScopePicker } from "../scope-picker";
import { parseStudyScope } from "../study-scope";
import { QuizCard } from "./quiz-card";

export const metadata: Metadata = { title: "Quiz · StudyForge AI" };

export default async function QuizPage({ searchParams }: PageProps<"/quiz">) {
  await requireOwner();
  const selected = parseStudyScope(await searchParams);
  const c = container();
  const [question, facets] = await Promise.all([c.quiz.nextQuestion(selected), c.library.facets()]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Quick quiz</h1>
        <p className="text-muted">Practice what you approved. Check the original source after every answer.</p>
      </header>
      <ScopePicker
        tags={facets.tags}
        sources={facets.sources}
        value={selected.scope === "all" ? "" : `${selected.scope}:${selected.value}`}
      />
      <QuizCard key={JSON.stringify(selected)} initial={question} scope={selected} />
    </div>
  );
}
