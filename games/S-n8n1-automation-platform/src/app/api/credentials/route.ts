import { db } from "@/db";
import { credentials } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextRequest } from "next/server";
import { encryptJson } from "@/lib/security/crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({ id: credentials.id, name: credentials.name, type: credentials.type, createdAt: credentials.createdAt })
    .from(credentials)
    .orderBy(desc(credentials.createdAt));
  return Response.json({ credentials: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.name || !body.type) {
    return Response.json({ error: "name و type الزامی هستند" }, { status: 400 });
  }
  const encryptedData = encryptJson(body.data || {});
  const [row] = await db
    .insert(credentials)
    .values({ name: body.name, type: body.type, encryptedData })
    .returning({ id: credentials.id, name: credentials.name, type: credentials.type, createdAt: credentials.createdAt });
  return Response.json({ credential: row }, { status: 201 });
}
