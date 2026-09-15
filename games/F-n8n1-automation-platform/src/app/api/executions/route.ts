// REST API: لیست اجراها با فیلتر و جستجو در داده‌ها
import { db } from "@/db";
import { executions } from "@/db/schema";
import { getSessionUser } from "@/lib/server/auth";
import { and, desc, eq, ilike, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!await getSessionUser(req)) return Response.json({ error: "احراز هویت لازم است" }, { status: 401 });
  const u = new URL(req.url);
  const status = u.searchParams.get("status");
  const workflowId = u.searchParams.get("workflowId");
  const q = u.searchParams.get("q");
  const limit = Math.min(Number(u.searchParams.get("limit") ?? 50), 200);
  const conds = [];
  if (status) conds.push(eq(executions.status, status));
  if (workflowId) conds.push(eq(executions.workflowId, Number(workflowId)));
  if (q) conds.push(ilike(sql`${executions.result}::text`, `%${q}%`));
  const rows = await db
    .select({ id: executions.id, workflowId: executions.workflowId, workflowName: executions.workflowName, status: executions.status, mode: executions.mode, error: executions.error, startedAt: executions.startedAt, finishedAt: executions.finishedAt, durationMs: executions.durationMs })
    .from(executions)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(executions.id))
    .limit(limit);
  return Response.json(rows);
}

export async function DELETE(req: Request) {
  const actor = await getSessionUser(req);
  if (!actor || !["owner", "admin"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  await db.delete(executions);
  return Response.json({ ok: true });
}
