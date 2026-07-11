import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function encryptionKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();

  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required before storing Gmail OAuth tokens");
  }

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) {
    return decoded;
  }

  if (raw.length >= 32 && process.env.NODE_ENV !== "production") {
    return createHash("sha256").update(raw).digest();
  }

  throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte base64 value. Generate one with: openssl rand -base64 32");
}

export function assertTokenEncryptionConfigured() {
  encryptionKey();
}

export function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptToken(value: string) {
  const [ivSegment, tagSegment, encryptedSegment] = value.split(".");

  if (!ivSegment || !tagSegment || !encryptedSegment) {
    throw new Error("Encrypted token payload is invalid");
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivSegment, "base64url"));
  decipher.setAuthTag(Buffer.from(tagSegment, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedSegment, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
