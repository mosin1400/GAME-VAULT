/**
 * پایگاه دانش خودتکامل‌شونده (Self-Evolving Memory)
 * ---------------------------------------------------
 * - پس از هر ساخت موفق: (درخواست، Workflow) به‌عنوان الگوی موفق ذخیره می‌شود.
 * - پس از هر Self-Heal موفق: خطا + راه‌حل به‌عنوان «درس» ذخیره می‌شود.
 * - قبل از هر تولید: مرتبط‌ترین دانش با تطبیق کلیدواژه بازیابی و به Prompt تزریق می‌شود.
 *
 * نتیجه: هر بار استفاده، نمونه‌های بهتری به مدل می‌رسد و دقت بالاتر می‌رود.
 */
import { db } from "@/db";
import { knowledgeBase, type KnowledgeEntry } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

/** کلمات بی‌معنی که در تطبیق نادیده گرفته می‌شوند */
const STOP_WORDS = new Set([
  "یک", "که", "به", "را", "و", "از", "در", "با", "این", "آن", "بساز", "کن", "کنه", "باشه", "هر", "چی",
  "the", "a", "an", "to", "and", "of", "that", "make", "build", "create", "me", "for", "it", "is",
]);

/** استخراج کلیدواژه‌های ساده از متن */
export function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return Array.from(new Set(words)).slice(0, 25);
}

/** بازیابی دانش مرتبط (امتیاز = تعداد کلیدواژه‌های مشترک + وزن استفاده) */
export async function retrieveKnowledge(prompt: string, limit = 5): Promise<KnowledgeEntry[]> {
  const keys = extractKeywords(prompt);
  const all = await db.select().from(knowledgeBase).orderBy(desc(knowledgeBase.createdAt)).limit(200);

  const scored = all
    .map((entry) => {
      const overlap = entry.keywords.filter((k) => keys.includes(k)).length;
      // درس‌های خطا همیشه ارزشمندند؛ حداقل امتیاز ۱ می‌گیرند
      const base = entry.kind === "error_fix" ? 1 : 0;
      return { entry, score: base + overlap * 2 + Math.min(entry.usageCount, 5) * 0.2 };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // افزایش شمارندهٔ استفاده (وزن‌دهی تدریجی)
  for (const s of scored) {
    await db
      .update(knowledgeBase)
      .set({ usageCount: sql`${knowledgeBase.usageCount} + 1` })
      .where(eq(knowledgeBase.id, s.entry.id));
  }
  return scored.map((s) => s.entry);
}

/** ذخیرهٔ الگوی موفق */
export async function rememberSuccess(prompt: string, workflowJson: unknown): Promise<void> {
  await db.insert(knowledgeBase).values({
    kind: "success_pattern",
    keywords: extractKeywords(prompt),
    prompt,
    workflowJson,
  });
}

/** ذخیرهٔ درس آموخته‌شده از خطا */
export async function rememberLesson(prompt: string, error: string, fix: string): Promise<void> {
  await db.insert(knowledgeBase).values({
    kind: "error_fix",
    keywords: extractKeywords(`${prompt} ${error}`),
    prompt,
    lesson: `وقتی خطای «${error.slice(0, 160)}» رخ داد، راه‌حل: ${fix}`,
  });
}

/** آمار پایگاه دانش برای داشبورد */
export async function knowledgeStats() {
  const rows = await db
    .select({ kind: knowledgeBase.kind, count: sql<number>`count(*)::int` })
    .from(knowledgeBase)
    .groupBy(knowledgeBase.kind);
  return {
    successPatterns: rows.find((r) => r.kind === "success_pattern")?.count ?? 0,
    lessons: rows.find((r) => r.kind === "error_fix")?.count ?? 0,
  };
}
