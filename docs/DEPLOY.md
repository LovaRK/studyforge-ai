# Deploying StudyForge AI on Replit

Replit is the intended host for the mission submission. Deployment is an owner action because it creates a production database, handles secrets and publishes a URL. The repository supplies deterministic build and run commands in `.replit`.

## Import and configure

1. In Replit, import `https://github.com/LovaRK/studyforge-ai` from GitHub.
2. Open the Replit Database tool. Use the app's `DATABASE_URL`; current Replit databases provide the connection through this single variable.
3. Add these values in Replit Secrets. Never paste them into `.replit`, Git, logs or chat:
   - `OWNER_PASSWORD`: a new password for this deployment.
   - `SESSION_SECRET`: a new random value of at least 32 characters.
   - `LLM_PROVIDER=gemini`.
   - `GEMINI_API_KEY`: the Google AI Studio key.
   - `GEMINI_MODEL`: a currently available Flash or Flash-Lite model chosen from the Gemini model list.
   - Optional `LLM_REQUESTS_PER_MINUTE` (default: `10`).
4. Press **Run** once. The workspace command installs packages from the lockfile, applies migrations and starts Next.js on port 3000. Sign in and use **Load original demo note** to verify extraction without spending model quota.

## Publish

1. Open **Publishing**, then **Adjust settings**, and set the deployment type to **Reserved VM** (the shared 0.5 vCPU / 2 GB machine is enough). Do not use Autoscale: extraction keeps calling the model in the background for minutes after the upload request returns, but Autoscale scales to zero when idle and may run several instances, each with its own extraction queue and login rate limiter. A Reserved VM is one always-on server, which is what the in-process queue assumes. It has a fixed monthly cost (US$15 for the shared machine when checked on 1 November 2026), paid from the plan's monthly credits first; confirm the price on the publishing screen before you publish. `.replit` does not set the deployment type, and the publishing screen may preselect Autoscale, so check the type there too.
2. In production database settings, enable **Create production database**. Copy development data only if it is intentionally safe to publish; the original demo is safe, private study material is not.
3. Confirm the production deployment has its own `DATABASE_URL` and the five required secrets above.
4. Publish. Replit runs `npm ci --include=dev && npm run build`, then applies migrations and starts the production server. A failed migration stops startup rather than serving code against an old schema.

The `.replit` file selects Node 22, disables automatic dependency guessing, exposes local port 3000 and uses `npm ci --include=dev` in both the workspace and the deployment so the lockfile controls every installed package. The build (`typescript`, `tailwindcss`, `@tailwindcss/turbopack`) and the startup migration (`tsx`, `dotenv`) need development dependencies, so they are installed even if the build runs with `NODE_ENV=production`.

## Mandatory privacy and persistence checks

Run these against the published URL before submitting it:

1. Open a private window. `/`, `/dashboard`, `/quiz`, `/study` and `/api/backup` must expose no study data. Pages redirect to `/login`; the backup API returns `401`.
2. Sign in, load the original demo, approve one item and study it once. Download the JSON backup from the dashboard and keep it somewhere private.
3. Restart or republish the app. Sign in again and confirm the source, approved item and study state remain.
4. Download a second backup. Confirm it is a JSON attachment and contains the expected source, item, review and SRS records. It must not contain `passwordHash`, `ownerCredential`, `SESSION_SECRET`, `GEMINI_API_KEY` or `llmCache`.
5. At 375 px, check the dashboard, review queue, quiz and focused session in both light and dark mode.
6. Keep **Share to Showcase** off if the published app or screenshot contains private study material. The submission cover should use original demo data.

## Updating

Merge reviewed changes to `main`, pull them into the Replit app, run the checks, then republish. Database migrations are forward-only; download a backup before every schema update. Replit's publishing page shows build/run logs and lets the owner edit commands and secrets if startup fails.

## Rollback

If a publish fails, keep the previous deployment active, read the publish logs, and correct the build or migration. Do not point production at the development database as a shortcut. Restore database state only from a deliberate Replit checkpoint or a verified backup.

References checked on 1 November 2026: [Replit app configuration](https://docs.replit.com/references/project-setup/configuration), [Replit SQL database](https://docs.replit.com/references/data-and-storage/sql-database), [creating a production database while publishing](https://docs.replit.com/references/data-and-storage/create-production-database-when-publishing), and [monitoring a deployment](https://docs.replit.com/references/publishing/monitoring-a-deployment), [deployment types](https://docs.replit.com/features/publishing/deployment-types) and [publishing costs](https://docs.replit.com/billing/deployment-pricing).
