/**
 * POST|GET /api/agent/monitor
 * مانیتور سراسری: همهٔ Workflowهای فعال را بررسی می‌کند (برای cron / Schedule Trigger در n8n).
 * همچنین با بدنهٔ { workflowId, executionId, error } از Error Workflow n8n قابل فراخوانی است.
 */
import { db } from "@/db";
import { automationRequests } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { monitorRequest, selfHeal } from "@/lib/agent/builder";

export const dynamic = "force-dynamic";

async function runAll() {
  const rows = await db
    .select({ id: automationRequests.id })
    .from(automationRequests)
    .where(and(isNotNull(automationRequests.n8nWorkflowId), eq(automationRequests.status, "done")));
  const results = [];
  for (const r of rows) {
    try {
      results.push({ id: r.id, ...(await monitorRequest(r.id)) });
    } catch (e) {
      results.push({ id: r.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

export async function GET() {
  return Response.json({ ok: true, results: await runAll() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { workflowId?: string; error?: string };
  // گزارش مستقیم خطا از n8n Error Workflow → Self-Heal هدفمند
  if (body.workflowId && body.error) {
    const [row] = await db
      .select({ id: automationRequests.id })
      .from(automationRequests)
      .where(eq(automationRequests.n8nWorkflowId, body.workflowId));
    if (!row) return Response.json({ ok: false, error: "workflow not managed by agent" }, { status: 404 });
    await selfHeal(row.id, body.error);
    return Response.json({ ok: true, healedRequestId: row.id });
  }
  return Response.json({ ok: true, results: await runAll() });
}
