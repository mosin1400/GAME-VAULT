import { db } from "@/db";
import { variables } from "@/db/schema";
import { eq } from "drizzle-orm";
import { audit } from "@/lib/server/utils";
import { getSessionUser } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getSessionUser(_r);
  if (!actor || !["owner", "admin", "editor"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const { id } = await params;
  await db.delete(variables).where(eq(variables.id, Number(id)));
  await audit("delete", "variable", id);
  return Response.json({ ok: true });
}
