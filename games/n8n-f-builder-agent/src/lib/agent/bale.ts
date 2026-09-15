/**
 * کلاینت پیام‌رسان بله (Bale Messenger Bot API)
 * ------------------------------------------------
 * API بله با Telegram Bot API سازگار است:
 *   https://tapi.bale.ai/bot{TOKEN}/{method}
 *
 * متدهای استفاده‌شده: sendMessage, setWebhook, deleteWebhook, getMe, getWebhookInfo
 * همچنین سروش (Soroush) با ساختار مشابه پشتیبانی می‌شود (SOROUSH_BOT_TOKEN / SOROUSH_API_BASE).
 */

export interface BaleUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; last_name?: string; username?: string };
    chat: { id: number; type?: string; title?: string };
    date: number;
    text?: string;
    caption?: string;
  };
  callback_query?: {
    id: string;
    from?: { id: number; first_name?: string; username?: string };
    message?: { chat: { id: number } };
    data?: string;
  };
}

type Channel = "bale" | "soroush";

function config(channel: Channel): { base: string; token: string | undefined } {
  if (channel === "soroush") {
    return {
      base: (process.env.SOROUSH_API_BASE ?? "https://bot.splus.ir").replace(/\/$/, ""),
      token: process.env.SOROUSH_BOT_TOKEN,
    };
  }
  return {
    base: (process.env.BALE_API_BASE ?? "https://tapi.bale.ai").replace(/\/$/, ""),
    token: process.env.BALE_BOT_TOKEN,
  };
}

export function isBaleConfigured(): boolean {
  return Boolean(process.env.BALE_BOT_TOKEN);
}

/** فراخوانی عمومی متد Bot API */
async function call<T>(channel: Channel, method: string, body?: Record<string, unknown>): Promise<T> {
  const { base, token } = config(channel);
  if (!token) throw new Error(`${channel.toUpperCase()}_BOT_TOKEN تنظیم نشده است`);
  const res = await fetch(`${base}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(`${channel} API ${method} failed: ${data.description ?? res.status}`);
  }
  return data.result as T;
}

/** ارسال پیام متنی (بله پیام‌های بلند را رد می‌کند؛ بنابراین تکه‌تکه می‌فرستیم) */
export async function sendMessage(chatId: string | number, text: string, channel: Channel = "bale"): Promise<void> {
  const MAX = 3800;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += MAX) chunks.push(text.slice(i, i + MAX));
  for (const chunk of chunks) {
    await call(channel, "sendMessage", { chat_id: chatId, text: chunk });
  }
}

/** ارسال بی‌خطا (برای اعلان‌های غیربحرانی) */
export async function trySendMessage(chatId: string | number | null | undefined, text: string, channel: Channel = "bale") {
  if (!chatId) return;
  try {
    await sendMessage(chatId, text, channel);
  } catch (e) {
    console.error(`[${channel}] sendMessage failed:`, e);
  }
}

/** تنظیم Webhook بات روی این سرور */
export async function setWebhook(url: string, channel: Channel = "bale"): Promise<unknown> {
  return call(channel, "setWebhook", { url });
}

export async function deleteWebhook(channel: Channel = "bale"): Promise<unknown> {
  return call(channel, "deleteWebhook");
}

export async function getMe(channel: Channel = "bale"): Promise<{ id: number; username?: string; first_name?: string }> {
  return call(channel, "getMe");
}

export async function getWebhookInfo(channel: Channel = "bale"): Promise<unknown> {
  return call(channel, "getWebhookInfo");
}

/** تبدیل update بله به پیام نرمال‌شده */
export function normalizeUpdate(update: BaleUpdate): { chatId: string; text: string; userName?: string } | null {
  const msg = update.message;
  if (msg) {
    const text = msg.text ?? msg.caption;
    if (!text) return null;
    const from = msg.from;
    const userName = from ? [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username : undefined;
    return { chatId: String(msg.chat.id), text, userName };
  }
  if (update.callback_query?.data && update.callback_query.message) {
    return {
      chatId: String(update.callback_query.message.chat.id),
      text: update.callback_query.data,
      userName: update.callback_query.from?.first_name,
    };
  }
  return null;
}
