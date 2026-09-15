/** POST /api/agent/requests/:id/monitor — بررسی اجراهای n8n برای این درخواست (لایهٔ ۴) */
import { monitorRequest } from "@/lib/agent/builder";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  try {
    const result = await monitorRequest(id);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
