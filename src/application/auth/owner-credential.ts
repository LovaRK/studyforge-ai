import type { OwnerCredentialStore, PasswordHasher } from "@/application/ports/auth";

/**
 * Makes the stored hash match OWNER_PASSWORD: hashes it on first boot and
 * re-hashes it when the env value has changed. Returns the current hash.
 */
export async function ensureOwnerCredential(deps: {
  store: OwnerCredentialStore;
  hasher: PasswordHasher;
  ownerPassword: string;
}): Promise<string> {
  const existing = await deps.store.getHash();
  if (existing && (await deps.hasher.verify(deps.ownerPassword, existing))) return existing;

  const hash = await deps.hasher.hash(deps.ownerPassword);
  await deps.store.saveHash(hash);
  return hash;
}
