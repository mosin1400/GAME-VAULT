// REST API: اجرای یک Workflow (دستی / API)
// بدنه اختیاری: { nodes, edges, triggerData, startNodeId, untilNodeId, save }
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { executeWorkflow } from "@/lib/engine/executor";
import { audit } from "@/lib/server/utils";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getSessionUser(req);
  if (!actor || !["owner", "admin", "editor", "member"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const [wf] = await db.select().from(workflows).where(eq(workflows.id, Number(id)));
  if (!wf) return Response.json({ error: "not found" }, { status: 404 });
  // امکان اجرای نسخه ذخیره‌نشده از ویرایشگر
  const target = { ...wf, nodes: body.nodes ?? wf.nodes, edges: body.edges ?? wf.edges };
  const r = await executeWorkflow(target, {
    mode: body.mode ?? "manual",
    triggerData: body.triggerData,
    startNodeId: body.startNodeId,
    untilNodeId: body.untilNodeId,
    save: body.save,
  });
  await audit("execute", "workflow", id, { executionId: r.executionId, status: r.status });
  return Response.json(r);
}
