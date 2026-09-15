/**
 * لایهٔ ۱ — Webhook بات بله
 * POST /api/webhook/bale   (بدنه: Update با ساختار Telegram-like)
 *
 * امنیت: اگر BALE_WEBHOOK_SECRET تنظیم شده باشد، باید در query (?secret=) یا هدر X-Webhook-Secret بیاید.
 * پیام فوراً تأیید (200) می‌شود و پردازش در پس‌زمینه ادامه می‌یابد.
 */
import { after } from "next/server";
import { normalizeUpdate, trySendMessage, type BaleUpdate } from "@/lib/agent/bale";
import { createRequest, processRequest } from "@/lib/agent/builder";

export const dynamic = "force-dynamic";

const HELP = `👋 سلام! من «Agent سازندهٔ اتوماسیون» هستم.
کافی است بگویید چه اتوماسیونی می‌خواهید؛ من آن را در n8n طراحی، پیاده‌سازی و فعال می‌کنم.

مثال:
«یک بات بله بساز که به کدکس وصل باشه و هر چی بگم رو ترجمه کنه»`;

export async function POST(req: Request) {
  const secret = process.env.BALE_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") ?? req.headers.get("x-webhook-secret");
    if (provided !== secret) return Response.json({ ok: false }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as BaleUpdate | null;
  if (!update) return Response.json({ ok: false, error: "invalid body" }, { status: 400 });

  const msg = normalizeUpdate(update);
  if (!msg) return Response.json({ ok: true, skipped: true });

  // دستورات ساده
  if (/^\/(start|help)/.test(msg.text.trim())) {
    after(() => trySendMessage(msg.chatId, HELP, "bale"));
    return Response.json({ ok: true });
  }

  const id = await createRequest({ source: "bale", chatId: msg.chatId, userName: msg.userName, text: msg.text });
  after(async () => {
    await trySendMessage(msg.chatId, `🛠 درخواست #${id} دریافت شد. در حال طراحی و ساخت Workflow در n8n...`, "bale");
    await processRequest(id);
  });
  return Response.json({ ok: true, id });
}

/** بله گاهی برای اعتبارسنجی آدرس، GET می‌زند */
export async function GET() {
  return Response.json({ ok: true, service: "automation-builder-agent", channel: "bale" });
}
