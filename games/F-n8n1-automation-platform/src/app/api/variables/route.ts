// REST API: متغیرهای سراسری
import { db } from "@/db";
import { variables } from "@/db/schema";
import { audit } from "@/lib/server/utils";
import { getSessionUser } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await getSessionUser(request)) return Response.json({ error: "احراز هویت لازم است" }, { status: 401 });
  return Response.json(await db.select().from(variables).orderBy(variables.key));
}
export async function POST(req: Request) {
  const actor = await getSessionUser(req);
  if (!actor || !["owner", "admin", "editor"].includes(actor.role)) return Response.json({ error: "دسترسی کافی نیست" }, { status: 403 });
  const body = await req.json();
  const key = String(body.key ?? "").trim().replace(/[^\w]/g, "_");
  if (!key) return Response.json({ error: "key required" }, { status: 400 });
  const [row] = await db.insert(variables).values({ key, value: String(body.value ?? ""), description: body.description ?? "" }).onConflictDoUpdate({ target: variables.key, set: { value: String(body.value ?? ""), description: body.description ?? "" } }).returning();
  await audit("upsert", "variable", key);
  return Response.json(row, { status: 201 });
}
