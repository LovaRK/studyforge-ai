## What and why

<!-- One or two sentences. Link the issue: Closes #… -->

## How it was tested

- [ ] `npm run format:check && npm run lint && npm run typecheck`
- [ ] `npm test` (unit)
- [ ] `npm run test:int` (Postgres)
- [ ] `npm run test:e2e` (if UI or a user flow changed)
- [ ] Checked by hand in the browser (describe below, add a screenshot for UI changes)

## Checklist

- [ ] Stays inside the track's owned paths in `docs/PLAN.md`, or the other track agreed to the change
- [ ] Schema changes come with a generated migration in `drizzle/`
- [ ] Source facts and generated text stay separate and labelled
- [ ] No secrets, study PDFs or personal material in the diff
- [ ] README / docs updated if behaviour or setup changed
