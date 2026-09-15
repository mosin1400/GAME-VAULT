// REST API: تاریخچه نسخه‌ها (Version Control) + بازگردانی
import { db } from "@/db";
import { workflows, workflowVersions } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { audit } from "@/lib/server/utils";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  if (!await getSessionUser(_req)) return Response.json({ error: "احراز هویت لازم است" }, { status: 401 });
  const { id } = await params;
  const rows = await db.select().from(workflowVersions).where(eq(workflowVersions.workflowId, Number(id))).orderBy(desc(workflowVersions.version));
  return Response.json(rows);
}

/** بازگردانی به نسخه مشخص: { version } */
export async function POST(req: Request, { params }: Ctx) {
  const actor = await getSessionUser(req);
  if (!actor || !["owner", "admin", "editor"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const { id } = await params;
  const { version } = await req.json();
  const [v] = await db.select().from(workflowVersions).where(and(eq(workflowVersions.workflowId, Number(id)), eq(workflowVersions.version, Number(version))));
  if (!v) return Response.json({ error: "version not found" }, { status: 404 });
  const [cur] = await db.select().from(workflows).where(eq(workflows.id, Number(id)));
  const newVersion = (cur?.version ?? 0) + 1;
  const [row] = await db.update(workflows).set({ nodes: v.nodes, edges: v.edges, version: newVersion, updatedAt: new Date() }).where(eq(workflows.id, Number(id))).returning();
  await db.insert(workflowVersions).values({ workflowId: row.id, version: newVersion, nodes: v.nodes, edges: v.edges, message: `restore v${version}` });
  await audit("restore", "workflow", id, { from: version, to: newVersion });
  return Response.json(row);
}
