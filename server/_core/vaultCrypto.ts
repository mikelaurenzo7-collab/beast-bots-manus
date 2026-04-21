import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

export type PackedEncrypted = {
  ciphertext: string;
  iv: string;
  tag: string;
  salt: string;
};

function deriveKey(masterSecret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterSecret, salt, 100000, 32, "sha256");
}

export function encryptSecret(token: string, masterSecret: string): PackedEncrypted {
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

export function decryptSecret(encrypted: PackedEncrypted, masterSecret: string): string {
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