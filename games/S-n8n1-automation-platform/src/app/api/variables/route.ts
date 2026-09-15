import { db } from "@/db";
import { variables } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(variables).orderBy(desc(variables.createdAt));
  return Response.json({ variables: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.key) return Response.json({ error: "key الزامی است" }, { status: 400 });
  const [row] = await db
    .insert(variables)
    .values({ key: body.key, value: String(body.value ?? "") })
    .onConflictDoUpdate({ target: variables.key, set: { value: String(body.value ?? ""), updatedAt: new Date() } })
    .returning();
  return Response.json({ variable: row }, { status: 201 });
}
