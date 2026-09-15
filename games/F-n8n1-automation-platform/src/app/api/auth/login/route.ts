import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, sessionCookie, verifyPassword } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) return Response.json({ error: "ایمیل یا رمز عبور نادرست است" }, { status: 401 });
  const token = await createSession(user.id);
  return new Response(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name, role: user.role } }), { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookie(token) } });
}
