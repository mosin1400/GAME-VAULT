import { db } from "@/db";
import { workflows } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(workflows).orderBy(desc(workflows.updatedAt));
  return Response.json({ workflows: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const [row] = await db
    .insert(workflows)
    .values({
      name: body.name || "Workflow جدید",
      description: body.description || "",
      nodes: body.nodes || [],
      edges: body.edges || [],
      active: false,
    })
    .returning();
  return Response.json({ workflow: row }, { status: 201 });
}
