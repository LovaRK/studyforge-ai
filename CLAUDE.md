@AGENTS.md

# StudyForge AI – working rules

Private, source-grounded study app. Product spec: `docs/BRIEF.md` (local only, not in the repo).

## Commands

- `npm run db:up` – start local Postgres (Docker), credentials from `DATABASE_URL`
- `npm run db:generate` then `npm run db:migrate` – after changing `src/infrastructure/db/schema.ts`
- `npm run dev` – app on http://localhost:3000
- `npm run lint && npm run typecheck && npm test` – must pass before every commit
- `npm run test:int` – integration tests against Postgres (`<db>_test`, created and migrated automatically)
- `npm run test:e2e` – Playwright against its own `<db>_e2e`; the LLM is always mocked (`LLM_PROVIDER=mock`)
- Change dependencies with `npx npm@10 install …` – CI and Replit run Node 22's npm 10, and a lockfile written by npm 11 breaks `npm ci` there

## Architecture (dependencies point inwards)

- `src/domain` – pure logic and types. No I/O, no framework imports.
- `src/application` – use cases plus `ports/` interfaces. Depends only on `domain`.
- `src/infrastructure` – adapters for ports: Drizzle/Postgres, auth crypto, LLM providers, logging.
- `src/server/container.ts` – composition root; the only place that wires adapters into use cases.
- `src/app` – Next.js routes and UI. Calls use cases through `container()`.
- `src/proxy.ts` blocks signed-out requests, and every page, Server Action and route handler also calls `requireOwner()` / `isSignedIn()`.

## Rules

- Never print, log or commit `.env.local` or any key/password. The logger redacts sensitive keys; keep it that way.
- Never commit study PDFs or the owner's material. Demo seed text must be original.
- Validate every boundary (form input, env, LLM output) with zod.
- Every extracted item keeps its verbatim source excerpt; keep source facts separate from generated text.
- Small conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).
