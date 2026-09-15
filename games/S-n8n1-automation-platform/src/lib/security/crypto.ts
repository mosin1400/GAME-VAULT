// ==========================================================================
// رمزنگاری/رمزگشایی Credentialها با AES-256-GCM
// کلید از متغیر محیطی CREDENTIALS_SECRET خوانده می‌شود؛ در صورت نبود، یک کلید
// پایدار برای محیط توسعه از DATABASE_URL مشتق می‌شود تا اجرای محلی بدون تنظیم
// اضافه هم کار کند (برای Production حتماً CREDENTIALS_SECRET را ست کنید).
// ==========================================================================
import crypto from "crypto";

function getKey(): Buffer {
  const secret =
    process.env.CREDENTIALS_SECRET ||
    process.env.DATABASE_URL ||
    "workflow-automation-default-dev-secret";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function encryptJson(data: Record<string, unknown>): string {
  return encryptSecret(JSON.stringify(data));
}

export function decryptJson<T = Record<string, unknown>>(payload: string): T {
  return JSON.parse(decryptSecret(payload)) as T;
}
