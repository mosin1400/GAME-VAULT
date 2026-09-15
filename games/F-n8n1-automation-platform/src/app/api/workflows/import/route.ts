// REST API: Import Workflow از JSON (سازگار با خروجی Export و n8n ساده)
import { db } from "@/db";
import { workflows, workflowVersions } from "@/db/schema";
import { audit } from "@/lib/server/utils";
import type { WorkflowNode, WorkflowEdge } from "@/db/schema";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const actor = await getSessionUser(req);
  if (!actor || !["owner", "admin", "editor", "member"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const body = await req.json();
  let nodes: WorkflowNode[] = body.nodes ?? [];
  let edges: WorkflowEdge[] = body.edges ?? [];
  // تبدیل ساده فرمت n8n (connections → edges)
  if (body.connections && Array.isArray(body.nodes)) {
    nodes = body.nodes.map((n: { name: string; type: string; position?: [number, number]; parameters?: Record<string, unknown> }, i: number) => ({
      id: `n${i + 1}`,
      name: n.name,
      type: String(n.type).replace("n8n-nodes-base.", "").replace(/Trigger$/, "Trigger"),
      position: { x: n.position?.[0] ?? i * 250, y: n.position?.[1] ?? 200 },
      parameters: n.parameters ?? {},
    }));
    edges = [];
    for (const [srcName, conn] of Object.entries(body.connections as Record<string, { main?: { node: string }[][] }>)) {
      const src = nodes.find((n) => n.name === srcName);
      conn.main?.forEach((outs, hi) => outs.forEach((o) => { const tgt = nodes.find((n) => n.name === o.node); if (src && tgt) edges.push({ id: `e${edges.length + 1}`, source: src.id, target: tgt.id, sourceHandle: hi === 0 ? "main" : String(hi), targetHandle: "in0" }); }));
    }
  }
  const [row] = await db.insert(workflows).values({ name: body.name ?? "Imported Workflow", description: body.description ?? "", nodes, edges, settings: body.settings ?? {}, tags: body.tags ?? ["imported"] }).returning();
  await db.insert(workflowVersions).values({ workflowId: row.id, version: 1, nodes, edges, message: "import" });
  await audit("import", "workflow", row.id);
  return Response.json(row, { status: 201 });
}
