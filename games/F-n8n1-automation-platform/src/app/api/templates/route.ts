// REST API: قالب‌ها
import { TEMPLATES, TEMPLATE_COUNT } from "@/lib/templates";
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = u.searchParams.get("q")?.toLowerCase();
  const limit = Number(u.searchParams.get("limit") ?? 100);
  const list = q ? TEMPLATES.filter((t) => t.name.toLowerCase().includes(q) || t.tags.some((x) => x.includes(q)) || t.description.includes(q)) : TEMPLATES;
  return Response.json({ total: TEMPLATE_COUNT, filtered: list.length, templates: list.slice(0, limit).map(({ nodes, edges, ...rest }) => ({ ...rest, nodeCount: nodes.length, edgeCount: edges.length })) });
}
