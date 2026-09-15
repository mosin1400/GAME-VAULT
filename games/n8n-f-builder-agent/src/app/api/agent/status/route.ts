/** GET /api/agent/status — وضعیت اتصال‌ها و آمار پایگاه دانش برای داشبورد */
import { db } from "@/db";
import { automationRequests } from "@/db/schema";
import { sql } from "drizzle-orm";
import { isBaleConfigured } from "@/lib/agent/bale";
import { getProviderStatus, resolveProvider } from "@/lib/agent/codex";
import { knowledgeStats } from "@/lib/agent/knowledge";
import { isMcpConfigured, pingN8n } from "@/lib/agent/n8n";

export const dynamic = "force-dynamic";

export async function GET() {
  const [providers, activeProvider, n8n, knowledge, counts] = await Promise.all([
    getProviderStatus(),
    resolveProvider(),
    pingN8n(),
    knowledgeStats(),
    db
      .select({ status: automationRequests.status, count: sql<number>`count(*)::int` })
      .from(automationRequests)
      .groupBy(automationRequests.status),
  ]);
  const total = counts.reduce((a, c) => a + c.count, 0);
  const done = counts.find((c) => c.status === "done")?.count ?? 0;
  const failed = counts.find((c) => c.status === "failed")?.count ?? 0;
  return Response.json({
    ok: true,
    providers: { ...providers, active: activeProvider },
    n8n: { ...n8n, mcp: isMcpConfigured() },
    bale: { configured: isBaleConfigured() },
    knowledge,
    stats: { total, done, failed, inProgress: total - done - failed },
  });
}
