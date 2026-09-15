// ==========================================================================
// نودهای پایگاه‌داده: PostgreSQL Query (و پایه برای CDC Trigger)
// ==========================================================================
import { Pool } from "pg";
import type { NodeDefinition, FlowItem } from "../types";
import { buildScope, resolveExpressionDeep } from "../expression";

const poolCache = new Map<string, Pool>();
function getPool(connectionString: string): Pool {
  if (!poolCache.has(connectionString)) {
    poolCache.set(connectionString, new Pool({ connectionString, max: 3 }));
  }
  return poolCache.get(connectionString)!;
}

export const postgresQueryNode: NodeDefinition = {
  type: "postgresQuery",
  name: "PostgreSQL Query",
  group: "database",
  category: "Database",
  icon: "🐘",
  color: "#336791",
  description: "اجرای کوئری SQL دلخواه روی یک پایگاه‌داده PostgreSQL",
  credentialType: "postgres",
  properties: [
    { name: "query", label: "کوئری SQL", type: "code", rows: 6, required: true, default: "SELECT NOW() as now" },
  ],
  execute: async (ctx) => {
    const cred = ctx.credential as { connectionString?: string } | null;
    const connectionString = cred?.connectionString || process.env.DATABASE_URL || "";
    if (!connectionString) throw new Error("رشته‌ی اتصال PostgreSQL تنظیم نشده است");
    const pool = getPool(connectionString);
    const vars: Record<string, string> = {};
    const out: FlowItem[] = [];
    for (let i = 0; i < Math.max(1, ctx.items.length); i++) {
      const item = ctx.items[i] ?? { json: {} };
      const scope = buildScope(item, i, ctx.items, vars);
      const query = String(resolveExpressionDeep(ctx.parameters.query, scope));
      const result = await pool.query(query);
      for (const row of result.rows) out.push({ json: row as Record<string, unknown> });
    }
    return out.length ? out : [{ json: { affectedRows: 0 } }];
  },
};

export const databaseNodes: NodeDefinition[] = [postgresQueryNode];
