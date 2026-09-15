import { CATEGORIES, INTEGRATION_COUNT, CREDENTIAL_TYPES } from '@/lib/nodes/catalog';
import { loadNodeRegistry } from '@/lib/server/node-registry';
import { getSessionUser } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!await getSessionUser(request)) return Response.json({ error: 'احراز هویت لازم است' }, { status: 401 });
  const { catalog } = await loadNodeRegistry();
  const q = new URL(request.url).searchParams.get('q')?.toLowerCase();
  const nodes = q ? catalog.filter(n => `${n.name} ${n.type} ${n.description}`.toLowerCase().includes(q)) : catalog;
  return Response.json({ total: catalog.length, integrations: INTEGRATION_COUNT, categories: CATEGORIES, credentialTypes: CREDENTIAL_TYPES, nodes });
}
