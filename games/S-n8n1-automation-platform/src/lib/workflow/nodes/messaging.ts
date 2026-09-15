// ==========================================================================
// نودهای ارتباطی: Slack, Telegram, Discord, بله (Bale), سروش (Soroush), Email, Twilio
// ==========================================================================
import nodemailer from "nodemailer";
import type { ExecuteContext, FlowItem, NodeDefinition } from "../types";
import { buildScope, resolveExpressionDeep } from "../expression";

function firstScope(ctx: ExecuteContext) {
  const item = ctx.items[0] ?? { json: {} };
  return buildScope(item, 0, ctx.items, {});
}

export const slackNode: NodeDefinition = {
  type: "slack",
  name: "Slack",
  group: "communication",
  category: "Communication",
  icon: "💬",
  color: "#4a154b",
  description: "ارسال پیام به کانال Slack از طریق Incoming Webhook یا Bot Token",
  credentialType: "slackApi",
  properties: [
    { name: "text", label: "متن پیام", type: "text", default: "{{$json.message}}", required: true },
    { name: "channel", label: "کانال (در صورت استفاده از Bot Token)", type: "string", default: "" },
  ],
  execute: async (ctx) => {
    const scope = firstScope(ctx);
    const text = String(resolveExpressionDeep(ctx.parameters.text, scope) ?? "");
    const cred = ctx.credential as { webhookUrl?: string; botToken?: string } | null;
    if (cred?.webhookUrl) {
      const res = await fetch(cred.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      return [{ json: { ok: res.ok, statusCode: res.status } }];
    }
    if (cred?.botToken) {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cred.botToken}` },
        body: JSON.stringify({ channel: ctx.parameters.channel, text }),
      });
      const json = await res.json();
      return [{ json }];
    }
    throw new Error("Credential Slack تنظیم نشده (webhookUrl یا botToken لازم است)");
  },
};

export const telegramNode: NodeDefinition = {
  type: "telegram",
  name: "Telegram",
  group: "communication",
  category: "Communication",
  icon: "✈️",
  color: "#26a5e4",
  description: "ارسال پیام/عکس/فایل با Telegram Bot API",
  credentialType: "telegramApi",
  properties: [
    { name: "chatId", label: "Chat ID", type: "string", required: true, default: "{{$json.chatId}}" },
    { name: "text", label: "متن پیام", type: "text", default: "{{$json.message}}" },
  ],
  execute: async (ctx) => {
    const scope = firstScope(ctx);
    const cred = ctx.credential as { botToken?: string } | null;
    if (!cred?.botToken) throw new Error("Credential Telegram (botToken) تنظیم نشده است");
    const chatId = resolveExpressionDeep(ctx.parameters.chatId, scope);
    const text = String(resolveExpressionDeep(ctx.parameters.text, scope) ?? "");
    const res = await fetch(`https://api.telegram.org/bot${cred.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return [{ json: await res.json() }];
  },
};

export const discordNode: NodeDefinition = {
  type: "discord",
  name: "Discord",
  group: "communication",
  category: "Communication",
  icon: "🎮",
  color: "#5865f2",
  description: "ارسال پیام به کانال Discord از طریق Webhook",
  credentialType: "discordApi",
  properties: [
    { name: "content", label: "متن پیام", type: "text", default: "{{$json.message}}", required: true },
  ],
  execute: async (ctx) => {
    const scope = firstScope(ctx);
    const cred = ctx.credential as { webhookUrl?: string } | null;
    if (!cred?.webhookUrl) throw new Error("Credential Discord (webhookUrl) تنظیم نشده است");
    const content = String(resolveExpressionDeep(ctx.parameters.content, scope) ?? "");
    const res = await fetch(cred.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    return [{ json: { ok: res.ok, statusCode: res.status } }];
  },
};

/** بله (Bale Messenger) - Bot API مشابه Telegram روی دامنه‌ی tapi.bale.ai */
export const baleNode: NodeDefinition = {
  type: "baleMessenger",
  name: "بله (Bale Messenger)",
  group: "communication",
  category: "Communication",
  icon: "🔵",
  color: "#2fac66",
  description: "ارسال متن/عکس/فایل با بات بله (Bale Bot API)",
  credentialType: "baleApi",
  properties: [
    { name: "method", label: "نوع پیام", type: "options", default: "sendMessage", options: [
      { label: "متن (sendMessage)", value: "sendMessage" },
      { label: "عکس (sendPhoto)", value: "sendPhoto" },
      { label: "فایل (sendDocument)", value: "sendDocument" },
    ] },
    { name: "chatId", label: "Chat ID", type: "string", required: true, default: "{{$json.chatId}}" },
    { name: "text", label: "متن پیام", type: "text", default: "{{$json.message}}" },
    { name: "fileUrl", label: "آدرس فایل/عکس (برای sendPhoto/sendDocument)", type: "string", default: "" },
  ],
  execute: async (ctx) => {
    const scope = firstScope(ctx);
    const cred = ctx.credential as { botToken?: string } | null;
    if (!cred?.botToken) throw new Error("Credential بله (botToken) تنظیم نشده است");
    const chatId = resolveExpressionDeep(ctx.parameters.chatId, scope);
    const method = String(ctx.parameters.method || "sendMessage");
    const base = `https://tapi.bale.ai/bot${cred.botToken}/${method}`;
    let payload: Record<string, unknown> = { chat_id: chatId };
    if (method === "sendMessage") {
      payload.text = String(resolveExpressionDeep(ctx.parameters.text, scope) ?? "");
    } else if (method === "sendPhoto") {
      payload.photo = String(resolveExpressionDeep(ctx.parameters.fileUrl, scope) ?? "");
      payload.caption = String(resolveExpressionDeep(ctx.parameters.text, scope) ?? "");
    } else {
      payload.document = String(resolveExpressionDeep(ctx.parameters.fileUrl, scope) ?? "");
      payload.caption = String(resolveExpressionDeep(ctx.parameters.text, scope) ?? "");
    }
    const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return [{ json: await res.json() }];
  },
};

/** سروش (Soroush Plus) - API مبتنی بر bot.sapp.ir */
export const soroushNode: NodeDefinition = {
  type: "soroushMessenger",
  name: "سروش (Soroush Plus)",
  group: "communication",
  category: "Communication",
  icon: "🟢",
  color: "#00a99d",
  description: "ارسال متن/فایل/لوکیشن با بات سروش پلاس (Master Bot API)",
  credentialType: "soroushApi",
  properties: [
    { name: "to", label: "شناسه گیرنده (to)", type: "string", required: true, default: "{{$json.to}}" },
    { name: "messageType", label: "نوع پیام", type: "options", default: "TEXT", options: [
      { label: "متن (TEXT)", value: "TEXT" },
      { label: "فایل (FILE)", value: "FILE" },
      { label: "موقعیت مکانی (LOCATION)", value: "LOCATION" },
    ] },
    { name: "body", label: "متن/محتوا", type: "text", default: "{{$json.message}}" },
  ],
  execute: async (ctx) => {
    const scope = firstScope(ctx);
    const cred = ctx.credential as { token?: string } | null;
    if (!cred?.token) throw new Error("Credential سروش (token) تنظیم نشده است");
    const to = resolveExpressionDeep(ctx.parameters.to, scope);
    const body = String(resolveExpressionDeep(ctx.parameters.body, scope) ?? "");
    const res = await fetch(`https://bot.sapp.ir/${cred.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to, type: ctx.parameters.messageType || "TEXT", body }),
    });
    const text = await res.text();
    let json: unknown; try { json = JSON.parse(text); } catch { json = text; }
    return [{ json: { statusCode: res.status, response: json } }];
  },
};

export const emailNode: NodeDefinition = {
  type: "sendEmail",
  name: "Email (SMTP)",
  group: "communication",
  category: "Communication",
  icon: "📧",
  color: "#ef4444",
  description: "ارسال ایمیل از طریق سرور SMTP دلخواه (Gmail/Outlook/سرور اختصاصی)",
  credentialType: "smtp",
  properties: [
    { name: "to", label: "گیرنده", type: "string", required: true, default: "{{$json.to}}" },
    { name: "subject", label: "موضوع", type: "string", default: "{{$json.subject}}" },
    { name: "text", label: "متن ایمیل", type: "text", rows: 6, default: "{{$json.body}}" },
  ],
  execute: async (ctx) => {
    const scope = firstScope(ctx);
    const cred = ctx.credential as { host?: string; port?: number; user?: string; pass?: string; secure?: boolean } | null;
    if (!cred?.host) throw new Error("Credential SMTP تنظیم نشده است");
    const transporter = nodemailer.createTransport({
      host: cred.host,
      port: Number(cred.port) || 587,
      secure: Boolean(cred.secure),
      auth: cred.user ? { user: cred.user, pass: cred.pass } : undefined,
    });
    const info = await transporter.sendMail({
      from: cred.user,
      to: String(resolveExpressionDeep(ctx.parameters.to, scope)),
      subject: String(resolveExpressionDeep(ctx.parameters.subject, scope) ?? ""),
      text: String(resolveExpressionDeep(ctx.parameters.text, scope) ?? ""),
    });
    return [{ json: { messageId: info.messageId, accepted: info.accepted } }];
  },
};

export const twilioNode: NodeDefinition = {
  type: "twilioSms",
  name: "Twilio (SMS)",
  group: "communication",
  category: "Communication",
  icon: "📱",
  color: "#f22f46",
  description: "ارسال پیامک از طریق Twilio REST API",
  credentialType: "twilioApi",
  properties: [
    { name: "to", label: "شماره گیرنده", type: "string", required: true, default: "{{$json.to}}" },
    { name: "body", label: "متن پیامک", type: "text", default: "{{$json.message}}" },
  ],
  execute: async (ctx) => {
    const scope = firstScope(ctx);
    const cred = ctx.credential as { accountSid?: string; authToken?: string; fromNumber?: string } | null;
    if (!cred?.accountSid) throw new Error("Credential Twilio تنظیم نشده است");
    const params = new URLSearchParams({
      To: String(resolveExpressionDeep(ctx.parameters.to, scope)),
      From: cred.fromNumber || "",
      Body: String(resolveExpressionDeep(ctx.parameters.body, scope) ?? ""),
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cred.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${cred.accountSid}:${cred.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    return [{ json: await res.json() }];
  },
};

export const messagingNodes: NodeDefinition[] = [
  slackNode,
  telegramNode,
  discordNode,
  baleNode,
  soroushNode,
  emailNode,
  twilioNode,
];
