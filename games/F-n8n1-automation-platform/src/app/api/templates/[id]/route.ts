// REST API: استفاده از قالب → ساخت Workflow جدید
import { db } from "@/db";
import { workflows, workflowVersions } from "@/db/schema";
import { TEMPLATES } from "@/lib/templates";
import { audit } from "@/lib/server/utils";
import { getSessionUser } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(_r: Request, { params }: Ctx) {
  const { id } = await params;
  const t = TEMPLATES.find((x) => x.id === id);
  return t ? Response.json(t) : Response.json({ error: "not found" }, { status: 404 });
}
export async function POST(_r: Request, { params }: Ctx) {
  const actor = await getSessionUser(_r);
  if (!actor || !["owner", "admin", "editor", "member"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const { id } = await params;
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return Response.json({ error: "not found" }, { status: 404 });
  const [row] = await db.insert(workflows).values({ name: t.name, description: t.description, nodes: t.nodes, edges: t.edges, tags: t.tags }).returning();
  await db.insert(workflowVersions).values({ workflowId: row.id, version: 1, nodes: t.nodes, edges: t.edges, message: `template:${t.id}` });
  await audit("create_from_template", "workflow", row.id, { template: t.id });
  return Response.json(row, { status: 201 });
}
