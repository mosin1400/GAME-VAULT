import { executableNodes, catalog } from "@/lib/workflow/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const definitions = executableNodes.map((n) => ({
    type: n.type,
    name: n.name,
    group: n.group,
    category: n.category,
    icon: n.icon,
    color: n.color,
    description: n.description,
    isTrigger: Boolean(n.isTrigger),
    credentialType: n.credentialType || null,
    outputs: n.outputs || ["main"],
    properties: n.properties,
  }));
  return Response.json({ definitions, catalog });
}
