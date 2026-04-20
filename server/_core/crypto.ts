import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { ENV } from "./env";

const ALGO = "aes-256-gcm";
const KEY_SALT = "beast-bots-v1";
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = ENV.encryptionKey;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ENCRYPTION_KEY must be set and at least 32 characters. Generate with: openssl rand -hex 32"
    );
  }
  cachedKey = scryptSync(secret, KEY_SALT, 32);
  return cachedKey;
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns the base64 ciphertext (tag + payload) and the IV used.
 */
export function encryptToken(plaintext: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ciphertext = `${authTag.toString("base64")}:${encrypted.toString("base64")}`;
  return { ciphertext, iv: iv.toString("base64") };
}

/**
 * Decrypt a ciphertext produced by encryptToken.
 *
 * Legacy path: if `iv` is null/undefined, the value is returned as-is (plaintext).
 * This lets dev DBs with pre-encryption rows keep reading; they'll be re-encrypted
 * on the next write via saveApiKey / upsertOAuthConnection.
 */
export function decryptToken(ciphertext: string, iv: string | null | undefined): string {
  if (!iv) return ciphertext;
  const [tagB64, ctB64] = ciphertext.split(":");
  if (!tagB64 || !ctB64) {
    throw new Error("Malformed ciphertext — expected 'tag:payload'");
  }
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/** For tests: reset the cached key so env overrides take effect. */
export function __resetCryptoKeyCache(): void {
  cachedKey = null;
}
