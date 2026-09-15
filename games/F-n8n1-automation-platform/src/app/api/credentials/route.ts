// REST API: Credentialها (رمزنگاری‌شده در حالت ذخیره)
import { db } from "@/db";
import { credentials } from "@/db/schema";
import { desc } from "drizzle-orm";
import { encrypt, decrypt, maskSecrets, audit } from "@/lib/server/utils";
import { getSessionUser } from "@/lib/server/auth";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await getSessionUser(request)) return Response.json({ error: "احراز هویت لازم است" }, { status: 401 });
  const rows = await db.select().from(credentials).orderBy(desc(credentials.id));
  return Response.json(rows.map((r) => ({ id: r.id, name: r.name, type: r.type, createdAt: r.createdAt, data: maskSecrets(JSON.parse(decrypt(r.data))) })));
}
export async function POST(req: Request) {
  const actor = await getSessionUser(req);
  if (!actor || !["owner", "admin", "editor"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const body = await req.json();
  const [row] = await db.insert(credentials).values({ name: body.name, type: body.type, data: encrypt(JSON.stringify(body.data ?? {})) }).returning();
  await audit("create", "credential", row.id, { type: row.type });
  return Response.json({ id: row.id, name: row.name, type: row.type }, { status: 201 });
}
