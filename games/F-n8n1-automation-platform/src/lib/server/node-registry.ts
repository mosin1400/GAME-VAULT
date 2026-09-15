import { db } from '@/db';
import { customNodes } from '@/db/schema';
import { NODE_CATALOG } from '@/lib/nodes/catalog';
import { validateNodeSpec, customNodeDefinition, type CustomNodeSpec } from '@/lib/agent/node-spec';

export async function loadNodeRegistry() {
  const rows = await db.select().from(customNodes);
  const specs = new Map<string, CustomNodeSpec>();
  for (const row of rows) {
    const check = validateNodeSpec(row.specification);
    if (!check.spec) throw new Error(`Custom node specification invalid: ${row.type}`);
    specs.set(row.type, check.spec);
  }
  return { catalog: [...NODE_CATALOG, ...[...specs.values()].map(customNodeDefinition)], specs };
}
