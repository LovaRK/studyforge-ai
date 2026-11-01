import { databaseUrlWithSuffix } from "../src/test/integration/database";

/** A separate `<db>_e2e` database, so test runs never touch real data. */
export function e2eDatabaseUrl(): string {
  return process.env.E2E_DATABASE_URL ?? databaseUrlWithSuffix("e2e");
}
