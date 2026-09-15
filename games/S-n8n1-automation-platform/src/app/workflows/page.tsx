import { db } from "@/db";
import { workflows } from "@/db/schema";
import { desc } from "drizzle-orm";
import WorkflowsClient from "./WorkflowsClient";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const rows = await db.select().from(workflows).orderBy(desc(workflows.updatedAt));
  return <WorkflowsClient initialWorkflows={rows} />;
}
