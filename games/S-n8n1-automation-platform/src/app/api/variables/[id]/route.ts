import { db } from "@/db";
import { variables } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(variables).where(eq(variables.id, Number(id)));
  return Response.json({ ok: true });
}
