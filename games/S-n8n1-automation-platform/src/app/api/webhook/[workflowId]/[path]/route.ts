// ==========================================================================
// Route عمومی Webhook: /api/webhook/{workflowId}/{path}
// درخواست‌های HTTP ورودی را به نود webhookTrigger مطابق در Workflow متصل می‌کند
// توجه: مسیر (path) باید یک بخش تکی بدون / باشد.
// ==========================================================================
import { NextRequest } from "next/server";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runWorkflowGraph } from "@/lib/workflow/executor";
import type { WorkflowNode } from "@/lib/workflow/types";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest, workflowIdStr: string, requestPath: string) {
  const workflowId = Number(workflowIdStr);
  const rows = await db.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1);
  if (!rows.length || !rows[0].active) {
    return Response.json({ error: "Workflow پیدا نشد یا فعال نیست" }, { status: 404 });
  }
  const wf = rows[0];
  const nodes = (Array.isArray(wf.nodes) ? wf.nodes : []) as WorkflowNode[];
  const method = req.method.toUpperCase();
  const node = nodes.find(
    (n) =>
      n.data.type === "webhookTrigger" &&
      String(n.data.parameters?.path || "").replace(/^\//, "") === requestPath &&
      String(n.data.parameters?.method || "POST").toUpperCase() === method,
  );
  if (!node) return Response.json({ error: "هیچ Webhook مطابقی پیدا نشد" }, { status: 404 });

  let bodyJson: unknown = {};
  try { bodyJson = await req.json(); } catch { bodyJson = {}; }
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const headers = Object.fromEntries(req.headers.entries());

  const initialItems = [{ json: { body: bodyJson, query, headers, method, path: requestPath } }];
  const responseMode = String(node.data.parameters?.responseMode || "lastNode");

  if (responseMode === "immediate") {
    runWorkflowGraph(
      { id: wf.id, name: wf.name, nodes: wf.nodes, edges: wf.edges, errorWorkflowId: wf.errorWorkflowId },
      node.id,
      initialItems,
      "webhook",
    ).catch(() => {});
    return Response.json({ ok: true, received: true });
  }

  const result = await runWorkflowGraph(
    { id: wf.id, name: wf.name, nodes: wf.nodes, edges: wf.edges, errorWorkflowId: wf.errorWorkflowId },
    node.id,
    initialItems,
    "webhook",
  );
  return Response.json({ ok: result.status === "success", executionId: result.executionId, data: result.items.map((i) => i.json) });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ workflowId: string; path: string }> }) {
  const { workflowId, path } = await params;
  return handle(req, workflowId, path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ workflowId: string; path: string }> }) {
  const { workflowId, path } = await params;
  return handle(req, workflowId, path);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ workflowId: string; path: string }> }) {
  const { workflowId, path } = await params;
  return handle(req, workflowId, path);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ workflowId: string; path: string }> }) {
  const { workflowId, path } = await params;
  return handle(req, workflowId, path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ workflowId: string; path: string }> }) {
  const { workflowId, path } = await params;
  return handle(req, workflowId, path);
}
