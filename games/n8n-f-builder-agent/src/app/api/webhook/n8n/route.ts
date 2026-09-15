/**
 * لایهٔ ۱ — نود ورودی از n8n (راه‌اندازی دستی)
 * POST /api/webhook/n8n  { prompt, chatId?, wait? }
 * توسط Workflow الگو (n8n/workflows/automation-builder-template.json) فراخوانی می‌شود.
 * با wait=true پاسخ کامل (JSON Workflow + لینک) برگردانده می‌شود تا n8n بتواند آن را به کاربر بدهد.
 */
import { db } from "@/db";
import { automationRequests, generatedWorkflows } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { after } from "next/server";
import { createRequest, processRequest } from "@/lib/agent/builder";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.AGENT_SHARED_SECRET;
  if (secret && req.headers.get("x-agent-secret") !== secret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { prompt?: string; chatId?: string; wait?: boolean; userName?: string };
  if (!body.prompt || body.prompt.trim().length < 5) {
    return Response.json({ ok: false, error: "prompt is required" }, { status: 400 });
  }

  const id = await createRequest({ source: "n8n", text: body.prompt, chatId: body.chatId, userName: body.userName });
  if (!body.wait) {
    after(() => processRequest(id));
    return Response.json({ ok: true, id });
  }

  await processRequest(id);
  const [request] = await db.select().from(automationRequests).where(eq(automationRequests.id, id));
  const [wf] = await db
    .select()
    .from(generatedWorkflows)
    .where(eq(generatedWorkflows.requestId, id))
    .orderBy(desc(generatedWorkflows.version))
    .limit(1);
  return Response.json({
    ok: request?.status === "done",
    id,
    status: request?.status,
    summary: request?.resultSummary,
    n8nWorkflowId: request?.n8nWorkflowId,
    n8nWorkflowUrl: request?.n8nWorkflowUrl,
    workflow: wf?.workflowJson ?? null,
  });
}
