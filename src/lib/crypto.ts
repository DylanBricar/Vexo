import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
  timingSafeEqual,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 60_000;
let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const configuredKey = process.env.ENCRYPTION_KEY;
  if (!configuredKey || !/^[0-9a-f]{64}$/i.test(configuredKey)) {
    throw new Error(
      "ENCRYPTION_KEY doit contenir exactement 64 caractères hexadécimaux",
    );
  }
  cachedKey = Buffer.from(configuredKey, "hex");
  return cachedKey;
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(data: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertext] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function generateToken(userId: number): string {
  const payload = `${userId}:${Date.now()}`;
  const sig = createHmac("sha256", getEncryptionKey())
    .update(payload)
    .digest("hex");
  return `${payload}:${sig}`;
}

export function verifyToken(token: string): number | null {
  const parts = token.split(":");
  if (parts.length !== 3) return null;
  const [userIdStr, , sig] = parts;
  const payload = `${parts[0]}:${parts[1]}`;
  if (!/^[0-9a-f]{64}$/i.test(sig)) return null;
  const expected = createHmac("sha256", getEncryptionKey())
    .update(payload)
    .digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex")))
      return null;
  } catch {
    return null;
  }
  const uid = Number(userIdStr);
  if (!Number.isSafeInteger(uid) || uid <= 0) return null;
  const ts = Number(parts[1]);
  const age = Date.now() - ts;
  if (
    !Number.isSafeInteger(ts) ||
    age > TOKEN_TTL_MS ||
    age < -MAX_CLOCK_SKEW_MS
  )
    return null;
  return uid;
}

export function encryptOrNull(text: string | null): string | null {
  if (!text) return null;
  return encrypt(text);
}

export function decryptOrNull(data: string | null): string | null {
  if (!data) return null;
  if (!data.includes(":") || data.startsWith("data:")) return data;
  const parts = data.split(":");
  if (parts.length !== 3 || !/^[0-9a-f]+$/.test(parts[0])) return data;
  try {
    return decrypt(data);
  } catch {
    return data;
  }
}
