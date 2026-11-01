import { container } from "@/server/container";
import { requireOwner } from "@/server/session";
import { quizScopeSchema } from "@/application/quiz/quiz";
import { buttonClass, inputClass } from "@/components/ui";
import { QuizCard } from "./quiz-card";
export default async function QuizPage({ searchParams }: PageProps<"/quiz">) {
  await requireOwner();
  const params = await searchParams;
  const scope = quizScopeSchema.safeParse({ scope: params.scope ?? "all", value: params.value });
  const selected = scope.success ? scope.data : { scope: "all" as const };
  const c = container();
  const [question, facets] = await Promise.all([c.quiz.nextQuestion(selected), c.library.facets()]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Quick quiz</h1>
        <p className="text-muted">Practice what you approved. Check the original source after every answer.</p>
      </header>
      <form className="flex flex-wrap items-end gap-2" action="/quiz">
        <label className="text-sm">
          Selection
          <select name="scope" defaultValue={selected.scope} className={inputClass}>
            <option value="all">Everything</option>
            <option value="tag">Tag</option>
            <option value="source">Source</option>
          </select>
        </label>
        <label className="min-w-0 flex-1 text-sm">
          Tag or source
          <select name="value" defaultValue={"value" in selected ? selected.value : ""} className={inputClass}>
            <option value="">All approved items</option>
            <optgroup label="Tags">
              {facets.tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </optgroup>
            <optgroup label="Sources">
              {facets.sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <button className={buttonClass.secondary}>Apply</button>
      </form>
      <QuizCard key={JSON.stringify(selected)} initial={question} scope={selected} />
    </div>
  );
}
