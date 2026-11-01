import { prepareDatabase } from "../src/test/integration/database";
import { e2eDatabaseUrl } from "./database-url";

/** End-to-end runs start from an empty, migrated database of their own. */
export default async function globalSetup() {
  await prepareDatabase(e2eDatabaseUrl(), { truncate: true });
}
