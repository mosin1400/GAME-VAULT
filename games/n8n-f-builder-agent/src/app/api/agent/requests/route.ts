/** GET /api/agent/requests — فهرست درخواست‌ها (جدیدترین اول) */
import { db } from "@/db";
import { automationRequests } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(automationRequests).orderBy(desc(automationRequests.createdAt)).limit(100);
  return Response.json({ ok: true, requests: rows });
}
