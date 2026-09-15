import { count } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, sessionCookie } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const [{ total }] = await db.select({ total: count() }).from(users);
  if (Number(total) > 0) return Response.json({ error: "راه‌اندازی اولیه قبلاً انجام شده است" }, { status: 409 });
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "مدیر FlowForge").trim();
  const password = String(body.password ?? "");
  if (!email || !email.includes("@")) return Response.json({ error: "ایمیل معتبر لازم است" }, { status: 400 });
  const [user] = await db.insert(users).values({ email, name, role: "owner", passwordHash: await hashPassword(password), twoFactorEnabled: false }).returning();
  const token = await createSession(user.id);
  return new Response(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name, role: user.role } }), { status: 201, headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookie(token) } });
}
