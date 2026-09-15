import { db } from "@/db";
import { credentials } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, audit } from "@/lib/server/utils";
import { getSessionUser } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function PUT(req: Request, { params }: Ctx) {
  const actor = await getSessionUser(req);
  if (!actor || !["owner", "admin", "editor"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const [row] = await db.update(credentials).set({ name: body.name, type: body.type, data: encrypt(JSON.stringify(body.data ?? {})), updatedAt: new Date() }).where(eq(credentials.id, Number(id))).returning();
  await audit("update", "credential", id);
  return Response.json({ id: row.id, name: row.name, type: row.type });
}
export async function DELETE(_r: Request, { params }: Ctx) {
  const actor = await getSessionUser(_r);
  if (!actor || !["owner", "admin"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const { id } = await params;
  await db.delete(credentials).where(eq(credentials.id, Number(id)));
  await audit("delete", "credential", id);
  return Response.json({ ok: true });
}
