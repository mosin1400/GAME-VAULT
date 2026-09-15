import { db } from "@/db";
import { executions, executionLogs } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(executions).where(eq(executions.id, Number(id))).limit(1);
  if (!rows.length) return Response.json({ error: "پیدا نشد" }, { status: 404 });
  const logs = await db
    .select()
    .from(executionLogs)
    .where(eq(executionLogs.executionId, Number(id)))
    .orderBy(asc(executionLogs.startedAt));
  return Response.json({ execution: rows[0], logs });
}
