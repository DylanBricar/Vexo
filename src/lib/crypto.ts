import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(data: string): string {
  const [ivHex, authTagHex, ciphertext] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function generateToken(userId: number): string {
  const payload = `${userId}:${Date.now()}`;
  const sig = createHmac("sha256", KEY).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

export function verifyToken(token: string): number | null {
  const parts = token.split(":");
  if (parts.length !== 3) return null;
  const [userIdStr, , sig] = parts;
  const payload = `${parts[0]}:${parts[1]}`;
  const expected = createHmac("sha256", KEY).update(payload).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  const uid = Number(userIdStr);
  if (isNaN(uid) || uid <= 0) return null;
  const ts = Number(parts[1]);
  if (isNaN(ts) || Date.now() - ts > 86400000) return null;
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
