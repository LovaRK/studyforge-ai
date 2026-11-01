import { prepareDatabase, testDatabaseUrl } from "./database";

/** Creates the integration-test database if needed and applies all migrations to it. */
export default async function setup() {
  await prepareDatabase(testDatabaseUrl());
}
