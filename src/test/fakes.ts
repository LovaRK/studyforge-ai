import type { OwnerCredentialStore, PasswordHasher } from "@/application/ports/auth";

/** In-memory credential store for use-case tests. */
export class InMemoryOwnerCredentialStore implements OwnerCredentialStore {
  saves = 0;
  constructor(public hash: string | null = null) {}

  async getHash() {
    return this.hash;
  }

  async saveHash(hash: string) {
    this.saves += 1;
    this.hash = hash;
  }
}

/** Fast, transparent hasher so tests don't pay for scrypt. */
export class PlainTextHasher implements PasswordHasher {
  async hash(password: string) {
    return `plain:${password}`;
  }

  async verify(password: string, storedHash: string) {
    return storedHash === `plain:${password}`;
  }
}
