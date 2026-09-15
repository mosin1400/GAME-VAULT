// REST API: خواندن/ویرایش/حذف/فعال‌سازی یک Workflow
import { db } from "@/db";
import { workflows, workflowVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { audit } from "@/lib/server/utils";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  if (!await getSessionUser(_req)) return Response.json({ error: "احراز هویت لازم است" }, { status: 401 });
  const { id } = await params;
  const [row] = await db.select().from(workflows).where(eq(workflows.id, Number(id)));
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(row);
}

export async function PUT(req: Request, { params }: Ctx) {
  const actor = await getSessionUser(req);
  if (!actor || !["owner", "admin", "editor", "member"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const [cur] = await db.select().from(workflows).where(eq(workflows.id, Number(id)));
  if (!cur) return Response.json({ error: "not found" }, { status: 404 });
  const changed = JSON.stringify(cur.nodes) !== JSON.stringify(body.nodes ?? cur.nodes) || JSON.stringify(cur.edges) !== JSON.stringify(body.edges ?? cur.edges);
  const version = changed ? cur.version + 1 : cur.version;
  const [row] = await db
    .update(workflows)
    .set({
      name: body.name ?? cur.name,
      description: body.description ?? cur.description,
      nodes: body.nodes ?? cur.nodes,
      edges: body.edges ?? cur.edges,
      settings: body.settings ?? cur.settings,
      tags: body.tags ?? cur.tags,
      environment: body.environment ?? cur.environment,
      project: body.project ?? cur.project,
      active: body.active ?? cur.active,
      version,
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, Number(id)))
    .returning();
  if (changed) await db.insert(workflowVersions).values({ workflowId: row.id, version, nodes: row.nodes, edges: row.edges, message: body.commitMessage ?? "" });
  await audit("update", "workflow", row.id, { version, active: row.active });
  return Response.json(row);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const actor = await getSessionUser(req);
  if (!actor || !["owner", "admin", "editor"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const [row] = await db.update(workflows).set({ active: Boolean(body.active), updatedAt: new Date() }).where(eq(workflows.id, Number(id))).returning();
  await audit(body.active ? "activate" : "deactivate", "workflow", id);
  return Response.json(row);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const actor = await getSessionUser(_req);
  if (!actor || !["owner", "admin"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const { id } = await params;
  await db.delete(workflows).where(eq(workflows.id, Number(id)));
  await db.delete(workflowVersions).where(eq(workflowVersions.workflowId, Number(id)));
  await audit("delete", "workflow", id);
  return Response.json({ ok: true });
}
