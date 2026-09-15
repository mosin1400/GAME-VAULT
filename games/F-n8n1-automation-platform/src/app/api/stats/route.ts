// REST API: متریک‌های داشبورد
import { db } from "@/db";
import { workflows, executions, credentials } from "@/db/schema";
import { sql, desc } from "drizzle-orm";
import { NODE_COUNT, INTEGRATION_COUNT } from "@/lib/nodes/catalog";
import { TEMPLATE_COUNT } from "@/lib/templates";
import { runningExecutions } from "@/lib/engine/executor";
import { getSessionUser } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await getSessionUser(request)) return Response.json({ error: "احراز هویت لازم است" }, { status: 401 });
  const [wf] = await db.select({ total: sql<number>`count(*)::int`, active: sql<number>`count(*) filter (where active)::int` }).from(workflows);
  const [ex] = await db.select({
    total: sql<number>`count(*)::int`, success: sql<number>`count(*) filter (where status='success')::int`, error: sql<number>`count(*) filter (where status='error')::int`,
    avgMs: sql<number>`coalesce(avg(duration_ms),0)::int`, last24h: sql<number>`count(*) filter (where started_at > now() - interval '24 hours')::int`,
  }).from(executions);
  const [cr] = await db.select({ total: sql<number>`count(*)::int` }).from(credentials);
  const daily = await db.select({ day: sql<string>`to_char(started_at, 'MM-DD')`, total: sql<number>`count(*)::int`, errors: sql<number>`count(*) filter (where status='error')::int` }).from(executions).where(sql`started_at > now() - interval '14 days'`).groupBy(sql`to_char(started_at, 'MM-DD')`).orderBy(sql`to_char(started_at, 'MM-DD')`);
  const recent = await db.select({ id: executions.id, workflowName: executions.workflowName, status: executions.status, mode: executions.mode, startedAt: executions.startedAt, durationMs: executions.durationMs }).from(executions).orderBy(desc(executions.id)).limit(8);
  const topWorkflows = await db.select({ workflowName: executions.workflowName, workflowId: executions.workflowId, total: sql<number>`count(*)::int`, errors: sql<number>`count(*) filter (where status='error')::int` }).from(executions).groupBy(executions.workflowId, executions.workflowName).orderBy(desc(sql`count(*)`)).limit(5);
  return Response.json({ workflows: wf, executions: ex, credentials: cr.total, nodes: NODE_COUNT, integrations: INTEGRATION_COUNT, templates: TEMPLATE_COUNT, running: runningExecutions.size, daily, recent, topWorkflows, uptimeSec: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1048576) });
}
