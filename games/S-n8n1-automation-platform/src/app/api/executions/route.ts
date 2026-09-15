import { db } from "@/db";
import { executions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const workflowId = req.nextUrl.searchParams.get("workflowId");
  const limit = Number(req.nextUrl.searchParams.get("limit") || 50);
  const query = db.select().from(executions).orderBy(desc(executions.startedAt)).limit(limit);
  const rows = workflowId
    ? await db.select().from(executions).where(eq(executions.workflowId, Number(workflowId))).orderBy(desc(executions.startedAt)).limit(limit)
    : await query;
  return Response.json({ executions: rows });
}
