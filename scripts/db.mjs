// Runs `docker compose` for local Postgres, using the credentials in DATABASE_URL
// so there is a single source of truth. Usage: node --env-file=.env.local scripts/db.mjs up -d
import { spawnSync } from "node:child_process";

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is not set (expected in .env.local).");
  process.exit(1);
}

const url = new URL(raw);
const env = {
  ...process.env,
  POSTGRES_USER: decodeURIComponent(url.username),
  POSTGRES_PASSWORD: decodeURIComponent(url.password),
  POSTGRES_DB: url.pathname.replace(/^\//, ""),
  POSTGRES_PORT: url.port || "5432",
};

const result = spawnSync("docker", ["compose", ...process.argv.slice(2)], { stdio: "inherit", env });
process.exit(result.status ?? 1);
