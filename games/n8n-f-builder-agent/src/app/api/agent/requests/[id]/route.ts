/** GET /api/agent/requests/:id — جزئیات درخواست + نسخه‌های Workflow + لاگ‌ها + رویدادهای اجرا */
import { db } from "@/db";
import { agentLogs, automationRequests, executionEvents, generatedWorkflows } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: "invalid id" }, { status: 400 });

  const [request] = await db.select().from(automationRequests).where(eq(automationRequests.id, id));
  if (!request) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  const [workflows, logs, events] = await Promise.all([
    db.select().from(generatedWorkflows).where(eq(generatedWorkflows.requestId, id)).orderBy(desc(generatedWorkflows.version)),
    db.select().from(agentLogs).where(eq(agentLogs.requestId, id)).orderBy(asc(agentLogs.createdAt)),
    db.select().from(executionEvents).where(eq(executionEvents.requestId, id)).orderBy(desc(executionEvents.createdAt)).limit(50),
  ]);
  return Response.json({ ok: true, request, workflows, logs, events });
}

/** DELETE /api/agent/requests/:id — حذف درخواست (Workflow در n8n دست‌نخورده می‌ماند) */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  await db.delete(automationRequests).where(eq(automationRequests.id, id));
  return Response.json({ ok: true });
}
