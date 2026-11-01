import { eq } from "drizzle-orm";
import type { OwnerCredentialStore } from "@/application/ports/auth";
import type { Database } from "@/infrastructure/db/client";
import { ownerCredential } from "@/infrastructure/db/schema";

export class DrizzleOwnerCredentialStore implements OwnerCredentialStore {
  constructor(private readonly db: Database) {}

  async getHash(): Promise<string | null> {
    const rows = await this.db.select().from(ownerCredential).where(eq(ownerCredential.id, 1)).limit(1);
    return rows[0]?.passwordHash ?? null;
  }

  async saveHash(hash: string): Promise<void> {
    await this.db
      .insert(ownerCredential)
      .values({ id: 1, passwordHash: hash })
      .onConflictDoUpdate({ target: ownerCredential.id, set: { passwordHash: hash, updatedAt: new Date() } });
  }
}
