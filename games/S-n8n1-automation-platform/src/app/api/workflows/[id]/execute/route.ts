import { NextRequest } from "next/server";
import { runWorkflowById } from "@/lib/workflow/executor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const initialItems = Array.isArray(body.items) && body.items.length
    ? body.items
    : [{ json: body.json || {} }];
  try {
    const result = await runWorkflowById(Number(id), initialItems, "manual", body.startNodeId);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
