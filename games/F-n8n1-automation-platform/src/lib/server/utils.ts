// ============================================================================
// Server utilities – رمزنگاری در حالت ذخیره (AES-256-GCM) و Audit Log
// ============================================================================
import crypto from "crypto";
import { db } from "@/db";
import { auditLogs, credentials, variables } from "@/db/schema";
import { eq } from "drizzle-orm";

// کلید رمزنگاری از env خوانده می‌شود؛ در غیر این‌صورت کلید پیش‌فرض توسعه
const KEY = crypto
  .createHash("sha256")
  .update(process.env.ENCRYPTION_KEY ?? "flowforge-dev-encryption-key-change-me")
  .digest();

/** رمزنگاری متن (خروجی: iv:tag:cipher به base64) */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/** رمزگشایی */
export function decrypt(payload: string): string {
  try {
    const [ivB, tagB, dataB] = payload.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "{}";
  }
}

/** ماسک کردن مقادیر حساس برای نمایش در UI */
export function maskSecrets(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string" && /token|secret|password|key/i.test(k) && v.length > 4) {
      out[k] = v.slice(0, 3) + "•".repeat(Math.min(v.length - 3, 12));
    } else out[k] = v;
  }
  return out;
}

/** ثبت رخداد در Audit Log */
export async function audit(
  action: string,
  resource: string,
  resourceId?: string | number | null,
  details: Record<string, unknown> = {},
  actor = "admin",
) {
  try {
    await db.insert(auditLogs).values({
      actor,
      action,
      resource,
      resourceId: resourceId == null ? null : String(resourceId),
      details,
    });
  } catch {
    /* ignore audit failures */
  }
}

/** خواندن و رمزگشایی یک Credential */
export async function loadCredential(id?: number | null): Promise<Record<string, string>> {
  if (!id) return {};
  const [row] = await db.select().from(credentials).where(eq(credentials.id, id));
  if (!row) return {};
  try {
    return JSON.parse(decrypt(row.data));
  } catch {
    return {};
  }
}

/** خواندن همه متغیرهای سراسری به‌صورت map */
export async function loadVariables(): Promise<Record<string, string>> {
  const rows = await db.select().from(variables);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
