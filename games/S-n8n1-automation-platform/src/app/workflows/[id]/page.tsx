import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import WorkflowEditor from "./WorkflowEditor";

export const dynamic = "force-dynamic";

export default async function WorkflowEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(workflows).where(eq(workflows.id, Number(id))).limit(1);
  if (!rows.length) notFound();
  const allWorkflows = await db.select({ id: workflows.id, name: workflows.name }).from(workflows);
  return <WorkflowEditor workflow={rows[0]} allWorkflows={allWorkflows} />;
}
