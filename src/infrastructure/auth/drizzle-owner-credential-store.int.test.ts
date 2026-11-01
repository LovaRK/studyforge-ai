import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ensureOwnerCredential } from "@/application/auth/owner-credential";
import { connect, truncateAll } from "@/test/integration/database";
import { DrizzleOwnerCredentialStore } from "./drizzle-owner-credential-store";
import { ScryptPasswordHasher } from "./scrypt-password-hasher";

const { client, db } = connect();
const store = new DrizzleOwnerCredentialStore(db);
const hasher = new ScryptPasswordHasher({ N: 1024, r: 8, p: 1 });

beforeEach(() => truncateAll(db));
afterAll(() => client.end());

describe("DrizzleOwnerCredentialStore", () => {
  it("stores one hash and replaces it when the owner password changes", async () => {
    expect(await store.getHash()).toBeNull();

    const first = await ensureOwnerCredential({ store, hasher, ownerPassword: "first-password" });
    expect(await store.getHash()).toBe(first);
    expect(first).not.toContain("first-password");

    expect(await ensureOwnerCredential({ store, hasher, ownerPassword: "first-password" })).toBe(first);

    const second = await ensureOwnerCredential({ store, hasher, ownerPassword: "second-password" });
    expect(second).not.toBe(first);
    expect(await hasher.verify("second-password", (await store.getHash())!)).toBe(true);
  });
});
