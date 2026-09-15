import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { activateWorkflowTriggers, deactivateWorkflowTriggers } from "@/lib/workflow/triggerManager";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const active = Boolean(body.active);
  const [row] = await db
    .update(workflows)
    .set({ active, updatedAt: new Date() })
    .where(eq(workflows.id, Number(id)))
    .returning();
  if (!row) return Response.json({ error: "پیدا نشد" }, { status: 404 });
  if (active) await activateWorkflowTriggers(row.id);
  else await deactivateWorkflowTriggers(row.id);
  return Response.json({ workflow: row });
}
