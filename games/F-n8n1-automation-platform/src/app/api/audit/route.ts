import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const actor = await getSessionUser(request);
  if (!actor || !["owner", "admin"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  return Response.json(await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(200));
}
