import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { deactivateWorkflowTriggers } from "@/lib/workflow/triggerManager";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(workflows).where(eq(workflows.id, Number(id))).limit(1);
  if (!rows.length) return Response.json({ error: "پیدا نشد" }, { status: 404 });
  return Response.json({ workflow: rows[0] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["name", "description", "nodes", "edges", "errorWorkflowId", "environment", "tags"] as const) {
    if (key in body) updates[key] = body[key];
  }
  const [row] = await db.update(workflows).set(updates).where(eq(workflows.id, Number(id))).returning();
  if (!row) return Response.json({ error: "پیدا نشد" }, { status: 404 });
  return Response.json({ workflow: row });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deactivateWorkflowTriggers(Number(id));
  await db.delete(workflows).where(eq(workflows.id, Number(id)));
  return Response.json({ ok: true });
}
