// ==========================================================================
// واکشی و رمزگشایی Credential از دیتابیس
// ==========================================================================
import { db } from "@/db";
import { credentials, variables } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptJson } from "@/lib/security/crypto";

export async function getDecryptedCredential(
  id: number | null | undefined,
): Promise<Record<string, unknown> | null> {
  if (!id) return null;
  const rows = await db.select().from(credentials).where(eq(credentials.id, id)).limit(1);
  if (!rows.length) return null;
  try {
    return decryptJson(rows[0].encryptedData);
  } catch {
    return null;
  }
}

export async function getAllVariables(): Promise<Record<string, string>> {
  const rows = await db.select().from(variables);
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function getVariable(key: string): Promise<string | undefined> {
  const rows = await db.select().from(variables).where(eq(variables.key, key)).limit(1);
  return rows[0]?.value;
}
