<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# StudyForge AI – rules for every contributor and coding agent

Private, source-grounded study app (Next.js 16, TypeScript strict, Postgres + Drizzle). Read `README.md` for what it does, `docs/PLAN.md` for the work split and `CONTRIBUTING.md` for the workflow.

## Commands

- `npm run db:up` – local Postgres in Docker, credentials from `DATABASE_URL`
- `npm run db:generate` then `npm run db:migrate` – after changing `src/infrastructure/db/schema.ts`
- `npm run dev` – app on http://localhost:3000
- `npm run format:check && npm run lint && npm run typecheck && npm test` – before every commit
- `npm run test:int` – integration tests against Postgres (`<db>_test`, created and migrated automatically)
- `npm run test:e2e` – Playwright on its own `<db>_e2e` and port `E2E_PORT` (default 3100); the LLM is always mocked
- Change dependencies with `npx npm@10 install …`: CI and Replit run Node 22's npm 10, and a lockfile written by npm 11 breaks `npm ci` there

## Architecture (dependencies point inwards)

- `src/domain` – pure logic and types. No I/O, no framework imports.
- `src/application` – use cases plus `ports/` interfaces. Depends only on `domain` and its own ports.
- `src/infrastructure` – adapters for ports: Drizzle/Postgres repositories, auth crypto, LLM providers, text extraction, logging.
- `src/server/container.ts` – composition root; the only place that wires adapters into use cases.
- `src/app` – Next.js routes and UI. Calls use cases through `container()`. Server Actions validate input with zod and call `requireOwner()` first.
- `src/proxy.ts` blocks signed-out requests, and every page, Server Action and route handler also checks the session.

## Rules

- Never print, log or commit `.env.local` or any key or password. The logger redacts sensitive keys; keep it that way.
- Never commit study PDFs or the owner's material. Demo and test text must be original.
- `docs/BRIEF.md` and `docs/HANDOFF.md` are private and stay out of git.
- Validate every boundary (form input, env, LLM output) with zod.
- Every item keeps its verbatim source excerpt. Show the excerpt as **Source fact** and model wording as **Generated interpretation**; never present generated text as fact.
- Quizzes and flashcards use approved items only.
- Tests for everything you add: unit (`*.test.ts` next to the file), Postgres (`*.int.test.ts`), user flows (`e2e/`).
- Work on a branch and open a pull request; never push to `main` directly. Small conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).
