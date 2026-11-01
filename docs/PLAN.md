# Engineering plan

StudyForge AI is built by two coding agents working in parallel, **Claude Code (track A)** and **Codex (track B)**. Each owns a set of paths, works in its own git worktree, and reviews the other's pull requests.

## Requirements and status

Source: the Handshake mission "Create a Study App – Build a Living Study Guide" and the private product brief.

| #   | Requirement                                                                                                         | Status      | Owner                      |
| --- | ------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------- |
| 1   | Owner uploads their own material (PDF, Markdown, text)                                                              | Done        | A                          |
| 2   | Extract concepts, terms, systems, processes, how-tos, questions, each with its verbatim excerpt                     | Done        | A                          |
| 3   | Word-for-word check; failed excerpts rejected and counted                                                           | Done        | A                          |
| 4   | Review queue beside the source: approve, edit, merge, tag, discard, filters, bulk, shortcuts                        | Done        | A                          |
| 5   | Library grouped by type, Postgres full-text search, tag and source filters                                          | Planned     | A                          |
| 6   | Concept pages and how-to guides with linked excerpts and a labelled generated summary                               | Planned     | A                          |
| 7   | Flashcards with SM-2 (Again / Hard / Good / Easy) and due counts                                                    | Planned     | A                          |
| 8   | Quizzes from approved items only; distractors source-checked or labelled generated; excerpt shown after each answer | Planned     | B                          |
| 9   | Focused study session: pick tag or source, mixed due cards and quiz questions for N minutes                         | Planned     | A (uses B's quiz use case) |
| 10  | Understanding dashboard: mastery by tag and source, due cards, streak, accuracy, review counts, rejection rate      | Planned     | B                          |
| 11  | Backup: full JSON export (import if time allows)                                                                    | Planned     | B                          |
| 12  | Demo mode: original demo note and seed script                                                                       | Planned     | B                          |
| 13  | Login: owner-only, hashed password, signed httpOnly session, rate limit, everything protected                       | Done        | A                          |
| 14  | Persistence in Postgres across sessions                                                                             | Done        | A                          |
| 15  | Calm, private, responsive (375 px), light and dark                                                                  | In progress | both                       |
| 16  | Deploy on Replit (`.replit`, run commands, Secrets), then check privacy, persistence and backup                     | Planned     | B                          |
| 17  | README with screenshots and architecture; interview guide                                                           | Planned     | B, reviewed by A           |
| 18  | Tests (unit, Postgres, e2e) and CI for every feature                                                                | Ongoing     | both                       |

## Shared contract (on `main` before the split)

- **Database:** `src/infrastructure/db/schema.ts` and migration `0002_study_tools` define `item_search`, `srs_cards`, `card_reviews`, `quiz_questions`, `quiz_attempts` and `study_sessions`.
- **Vocabulary:** `src/domain/study/types.ts` defines grades, SRS state, quiz options and session scopes.
- **Quiz option provenance** describes where the option's wording comes from, never whether it is correct or approved. `source` means the text is a verified verbatim excerpt and the option carries that excerpt's range (`isVerbatimSourceOption` re-checks it). Everything else, including an approved item's `answer`, is `generated` and is labelled "Generated" in the UI.
- **Quiz API for the study session:** track B exposes `makeQuiz(deps)` from `src/application/quiz/quiz.ts` with:
  - `nextQuestion(scope: { scope: SessionScope; value?: string }, excludeIds?: string[]): Promise<QuizQuestionView | null>`
  - `answer(questionId: string, chosenIndex: number, sessionId?: string): Promise<{ correct: boolean; correctIndex: number; excerpts: Excerpt[] }>`

Changing the contract needs a small PR that the other track reviews first.

## Ownership

| Track A – Claude Code (`claude/*` branches)                                       | Track B – Codex (`codex/*` branches)                                                      |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/app/(app)/{sources,review,library,flashcards,study}/**`                      | `src/app/(app)/{quiz,dashboard}/**`, `src/app/api/backup/**`                              |
| `src/application/{sources,extraction,review,library,flashcards,study-session}/**` | `src/application/{quiz,dashboard,backup,demo}/**`                                         |
| `src/domain/{text,items}/**`, `src/domain/study/srs*`                             | `src/domain/quiz/**`                                                                      |
| repositories for sources, extraction, review, library, SRS, sessions              | repositories for quiz, dashboard, backup                                                  |
|                                                                                   | `scripts/seed-demo.ts`, `demo/**`, `.replit`, `docs/DEPLOY.md`, `docs/INTERVIEW_GUIDE.md` |

**Shared files** (`schema.ts`, `drizzle/`, `src/server/container.ts`, `src/app/(app)/nav-links.tsx`, `src/components/ui.tsx`, `src/domain/study/types.ts`, `package.json`, CI, `AGENTS.md`, `README.md`): additive changes only, rebase on `main` before merging, and call them out in the PR description.

## Working in parallel

|                         | Track A                             | Track B                                         |
| ----------------------- | ----------------------------------- | ----------------------------------------------- |
| Worktree                | `~/Desktop/studyforge-ai`           | `~/Desktop/studyforge-ai-codex`                 |
| `DATABASE_URL` database | `studyforge`                        | `studyforge_codex`                              |
| Test databases          | `studyforge_test`, `studyforge_e2e` | `studyforge_codex_test`, `studyforge_codex_e2e` |
| Dev server / `E2E_PORT` | 3000 / 3100                         | 3001 / 3200                                     |

Both use the same Docker Postgres. Database names never overlap, so tests can run at the same time.

## Pull requests and cross-review

1. One feature per branch and pull request, with the template filled in and CI green.
2. The **other** track reviews it: it checks out the branch, runs the checks, reads the diff against `AGENTS.md`, and posts a `gh pr review --comment` with findings ranked by severity. Both agents push as the same GitHub user, so a review is a comment that ends in **"LGTM"** or **"Changes requested"**.
3. The author fixes the findings and asks for a re-review. Once the reviewer says LGTM, **the owner merges** (squash). Agents never merge pull requests.
4. Problems found outside a PR become GitHub issues using the Task template, labelled `audit` or `bug`.

## Definition of done

- Behaviour matches the requirement row above, including empty, error and loading states, and works at 375 px in light and dark mode.
- Unit tests for domain and use cases, a Postgres test for every repository, and an e2e test for every user flow.
- `format:check`, `lint`, `typecheck`, `test`, `test:int`, `build` and `test:e2e` pass locally and in CI.
- No secrets, PDFs or owner material in the diff; README and docs updated.
