import { db } from "@/db";
import { credentials } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(credentials).where(eq(credentials.id, Number(id)));
  return Response.json({ ok: true });
}
