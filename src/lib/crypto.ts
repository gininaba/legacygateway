import crypto from "crypto";
import { CONFIG } from "./config";

const KEY = crypto.createHash("sha256").update(CONFIG.secret).digest();

/** Encrypt a string with AES-256-GCM; output base64(iv|tag|cipher). */
export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt a value produced by seal(). Returns "" on any tamper/error. */
export function open(packed: string): string {
  try {
    const raw = Buffer.from(packed, "base64");
    if (raw.length < 28) return "";
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function sha256(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
