/**
 * لایهٔ ۱ — Webhook بات سروش (ساختار مشابه بله)
 * POST /api/webhook/soroush
 */
import { after } from "next/server";
import { normalizeUpdate, trySendMessage, type BaleUpdate } from "@/lib/agent/bale";
import { createRequest, processRequest } from "@/lib/agent/builder";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const update = (await req.json().catch(() => null)) as BaleUpdate | null;
  if (!update) return Response.json({ ok: false }, { status: 400 });
  const msg = normalizeUpdate(update);
  if (!msg) return Response.json({ ok: true, skipped: true });

  const id = await createRequest({ source: "soroush", chatId: msg.chatId, userName: msg.userName, text: msg.text });
  after(async () => {
    await trySendMessage(msg.chatId, `🛠 درخواست #${id} دریافت شد. در حال ساخت Workflow...`, "soroush");
    await processRequest(id);
  });
  return Response.json({ ok: true, id });
}
