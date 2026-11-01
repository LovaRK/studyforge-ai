# Contributing

## Workflow

1. Branch from `main`: `feat/…`, `fix/…`, `test/…`, `docs/…`, `chore/…`.
2. Keep commits small and conventional (`feat(review): …`).
3. Before pushing, run everything CI runs:
   ```bash
   npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:int && npm run build && npm run test:e2e
   ```
4. Open a pull request with the template filled in. CI must be green and the PR needs one review before it is squash-merged.
5. Delete the branch after merging.

## Code standards

- Follow the layers in `AGENTS.md`: domain → application (use cases and ports) → infrastructure (adapters) → `src/app` (UI). Wire adapters only in `src/server/container.ts`.
- TypeScript strict, no `any`. Validate every boundary with zod.
- Every use case and adapter has tests: unit tests next to the file (`*.test.ts`), Postgres tests as `*.int.test.ts`, user flows in `e2e/`.
- Database changes: edit `src/infrastructure/db/schema.ts`, run `npm run db:generate`, commit the migration.
- Change dependencies with `npx npm@10 install …` so the lockfile matches Node 22 in CI and on Replit.

## Running two workers in parallel

Each worker uses its own git worktree, its own `DATABASE_URL` database name and its own `E2E_PORT`, so test databases and servers never collide. See `docs/PLAN.md`.
