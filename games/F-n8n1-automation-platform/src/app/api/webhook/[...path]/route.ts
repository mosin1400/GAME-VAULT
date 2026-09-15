// Webhook endpoint: /api/webhook/<path> → اجرای جریان‌های فعال با Webhook Trigger منطبق
// همچنین Bale/Telegram/Soroush/… Trigger ها با پارامتر path
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { executeWorkflow } from "@/lib/engine/executor";
import { getNodeDef } from "@/lib/nodes/catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WEBHOOK_TYPES = new Set(["webhookTrigger", "baleTrigger", "telegramTrigger", "soroushTrigger"]);

async function handle(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const p = path.join("/");
  const u = new URL(req.url);
  let body: unknown = null;
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("json")) body = await req.json();
    else if (ct.includes("form")) body = Object.fromEntries((await req.formData()).entries());
    else { const t = await req.text(); body = t ? (() => { try { return JSON.parse(t); } catch { return t; } })() : null; }
  } catch { body = null; }
  const headers = Object.fromEntries(req.headers.entries());
  const payload = { body, query: Object.fromEntries(u.searchParams.entries()), headers, method: req.method, path: p, receivedAt: new Date().toISOString(), ...(body && typeof body === "object" ? (body as object) : {}) };

  const active = await db.select().from(workflows).where(eq(workflows.active, true));
  const matches: { wf: (typeof active)[number]; nodeId: string; params: Record<string, unknown> }[] = [];
  for (const wf of active) for (const n of wf.nodes ?? []) {
    const def = getNodeDef(n.type);
    if (!def.trigger || n.disabled) continue;
    if (!(WEBHOOK_TYPES.has(n.type) || (n.type.endsWith(".trigger") && n.parameters?.mode !== "polling"))) continue;
    if (String(n.parameters?.path ?? "") !== p) continue;
    if (n.type === "webhookTrigger" && n.parameters?.method && String(n.parameters.method) !== req.method && String(n.parameters.method) !== "ANY") continue;
    if (n.parameters?.authToken && headers["authorization"] !== `Bearer ${n.parameters.authToken}` && headers["x-webhook-token"] !== n.parameters.authToken) return Response.json({ error: "unauthorized" }, { status: 401 });
    matches.push({ wf, nodeId: n.id, params: n.parameters ?? {} });
  }
  if (!matches.length) return Response.json({ error: `هیچ جریان فعالی برای مسیر "${p}" یافت نشد` }, { status: 404 });

  const results = [];
  for (const m of matches) {
    if (m.params.respondMode === "immediately") { executeWorkflow(m.wf, { mode: "webhook", startNodeId: m.nodeId, triggerData: payload }).catch(() => {}); results.push({ workflowId: m.wf.id, accepted: true }); continue; }
    const r = await executeWorkflow(m.wf, { mode: "webhook", startNodeId: m.nodeId, triggerData: payload });
    if (r.respond) return new Response(typeof r.respond.body === "string" ? r.respond.body : JSON.stringify(r.respond.body), { status: r.respond.statusCode, headers: { "Content-Type": typeof r.respond.body === "string" ? "text/plain; charset=utf-8" : "application/json" } });
    results.push({ workflowId: m.wf.id, executionId: r.executionId, status: r.status, error: r.error, output: r.lastOutput.map((i) => i.json) });
  }
  const single = results.length === 1 ? results[0] : results;
  const status = matches.some((m) => m.params.respondMode === "immediately") ? 202 : 200;
  return Response.json(single, { status });
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
