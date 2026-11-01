import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type { PasswordHasher } from "@/application/ports/auth";

const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

/** scrypt hashes stored as `scrypt$N$r$p$salt$hash` (base64url). */
export class ScryptPasswordHasher implements PasswordHasher {
  constructor(private readonly options: { N: number; r: number; p: number } = { N: 16384, r: 8, p: 1 }) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt, this.options);
    const { N, r, p } = this.options;
    return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [scheme, n, r, p, salt, expected] = storedHash.split("$");
    if (scheme !== "scrypt" || !salt || !expected) return false;
    const expectedKey = Buffer.from(expected, "base64url");
    const key = await derive(password, Buffer.from(salt, "base64url"), { N: Number(n), r: Number(r), p: Number(p) });
    return key.length === expectedKey.length && timingSafeEqual(key, expectedKey);
  }
}
