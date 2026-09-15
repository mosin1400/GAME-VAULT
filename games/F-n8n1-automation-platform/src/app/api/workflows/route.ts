// REST API: لیست و ایجاد Workflow
import { db } from "@/db";
import { workflows, workflowVersions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { audit } from "@/lib/server/utils";
import { getSessionUser } from "@/lib/server/auth";
import { validateDraft } from "@/lib/agent/validation";
import { credentials } from "@/db/schema";
import { loadNodeRegistry } from "@/lib/server/node-registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await getSessionUser(request)) return Response.json({ error: "احراز هویت لازم است" }, { status: 401 });
  const rows = await db.select().from(workflows).orderBy(desc(workflows.updatedAt));
  return Response.json(rows);
}

export async function POST(req: Request) {
  const actor = await getSessionUser(req);
  if (!actor || !["owner", "admin", "editor", "member"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.agentDraft === true) {
    const ids = await db.select({ id: credentials.id }).from(credentials);
    const registry = await loadNodeRegistry();
    const check = validateDraft(body, registry.catalog, ids.map((c) => c.id));
    if (!check.draft) return Response.json({ error: check.errors.join("؛ ") }, { status: 422 });
    body.nodes = check.draft.nodes; body.edges = check.draft.edges;
  }
  const [row] = await db
    .insert(workflows)
    .values({
      name: body.name || "جریان جدید",
      description: body.description ?? "",
      nodes: body.nodes ?? [],
      edges: body.edges ?? [],
      settings: body.settings ?? {},
      tags: body.tags ?? [],
      environment: body.environment ?? "dev",
      project: body.project ?? "default",
    })
    .returning();
  await db.insert(workflowVersions).values({ workflowId: row.id, version: 1, nodes: row.nodes, edges: row.edges, message: "initial" });
  await audit("create", "workflow", row.id, { name: row.name });
  return Response.json(row, { status: 201 });
}
