import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Derive a 256-bit key from a master secret using PBKDF2
 */
function deriveKey(masterSecret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterSecret, salt, 100000, 32, "sha256");
}

/**
 * Encrypt a token using AES-256-GCM
 * Returns: { ciphertext, iv, tag, salt } all base64-encoded
 */
export function encryptToken(
  token: string,
  masterSecret: string
): { ciphertext: string; iv: string; tag: string; salt: string } {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(masterSecret, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(token, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.from(ciphertext, "hex").toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    salt: salt.toString("base64"),
  };
}

/**
 * Decrypt a token using AES-256-GCM
 */
export function decryptToken(
  encrypted: { ciphertext: string; iv: string; tag: string; salt: string },
  masterSecret: string
): string {
  const salt = Buffer.from(encrypted.salt, "base64");
  const iv = Buffer.from(encrypted.iv, "base64");
  const tag = Buffer.from(encrypted.tag, "base64");
  const ciphertext = Buffer.from(encrypted.ciphertext, "base64");

  const key = deriveKey(masterSecret, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let plaintext = decipher.update(ciphertext, undefined, "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}

/**
 * Store encrypted token in a single string: salt:iv:tag:ciphertext (all base64)
 */
export function packEncrypted(encrypted: {
  ciphertext: string;
  iv: string;
  tag: string;
  salt: string;
}): string {
  return `${encrypted.salt}:${encrypted.iv}:${encrypted.tag}:${encrypted.ciphertext}`;
}

/**
 * Unpack a stored encrypted token
 */
export function unpackEncrypted(packed: string): {
  ciphertext: string;
  iv: string;
  tag: string;
  salt: string;
} {
  const [salt, iv, tag, ciphertext] = packed.split(":");
  return { salt, iv, tag, ciphertext };
}
