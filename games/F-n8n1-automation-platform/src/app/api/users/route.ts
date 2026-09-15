// REST API: کاربران و نقش‌ها (RBAC)
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/server/utils";
import { getSessionUser, hashPassword } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const actor = await getSessionUser(request);
  if (!actor || !["owner", "admin"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const rows = await db.select().from(users).orderBy(users.id);
  return Response.json(rows.map(({ passwordHash: _passwordHash, ...user }) => user));
}
export async function POST(req: Request) {
  const actor = await getSessionUser(req);
  if (!actor || !["owner", "admin"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const b = await req.json();
  const [row] = await db.insert(users).values({ email: b.email, name: b.name, role: b.role ?? "member", passwordHash: b.password ? await hashPassword(String(b.password)) : null, twoFactorEnabled: Boolean(b.twoFactorEnabled) }).returning();
  await audit("create", "user", row.id, { role: row.role });
  const { passwordHash: _passwordHash, ...safe } = row;
  return Response.json(safe, { status: 201 });
}
