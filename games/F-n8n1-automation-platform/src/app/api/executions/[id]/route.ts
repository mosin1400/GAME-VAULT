import { db } from "@/db";
import { executions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(_r: Request, { params }: Ctx) {
  if (!await getSessionUser(_r)) return Response.json({ error: "احراز هویت لازم است" }, { status: 401 });
  const { id } = await params;
  const [row] = await db.select().from(executions).where(eq(executions.id, Number(id)));
  return row ? Response.json(row) : Response.json({ error: "not found" }, { status: 404 });
}
export async function DELETE(_r: Request, { params }: Ctx) {
  const actor = await getSessionUser(_r);
  if (!actor || !["owner", "admin"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const { id } = await params;
  await db.delete(executions).where(eq(executions.id, Number(id)));
  return Response.json({ ok: true });
}
