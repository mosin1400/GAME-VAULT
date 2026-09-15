/**
 * مدیریت Webhook بات بله از داشبورد
 * POST /api/bale/webhook { action: "set" | "delete" | "info", baseUrl? }
 */
import { deleteWebhook, getMe, getWebhookInfo, setWebhook } from "@/lib/agent/bale";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; baseUrl?: string };
  try {
    if (body.action === "set") {
      const base = (body.baseUrl ?? process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
      if (!base) throw new Error("آدرس عمومی سرور (PUBLIC_BASE_URL) لازم است");
      const secret = process.env.BALE_WEBHOOK_SECRET ? `?secret=${process.env.BALE_WEBHOOK_SECRET}` : "";
      const result = await setWebhook(`${base}/api/webhook/bale${secret}`);
      return Response.json({ ok: true, result });
    }
    if (body.action === "delete") return Response.json({ ok: true, result: await deleteWebhook() });
    const [me, info] = await Promise.all([getMe(), getWebhookInfo()]);
    return Response.json({ ok: true, me, info });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
