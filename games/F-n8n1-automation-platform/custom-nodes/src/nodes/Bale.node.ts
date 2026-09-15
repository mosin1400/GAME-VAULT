// ============================================================================
// Bale Messenger Node – ارسال/دریافت متن، تصویر، فایل و تنظیم Webhook
// API: https://tapi.bale.ai/bot<TOKEN>/<method>  (سازگار با Telegram Bot API)
// ============================================================================
import { type INodeType, type ExecuteContext, type Item, requestJson } from "../types";

export class Bale implements INodeType {
  description = {
    displayName: "Bale Messenger",
    name: "bale",
    group: ["output" as const],
    version: 1,
    description: "ارسال و دریافت پیام در پیام‌رسان بله",
    icon: "file:bale.svg",
    defaults: { name: "Bale", color: "#16a34a" },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [{ name: "baleApi", required: true }],
    properties: [
      { displayName: "Operation", name: "operation", type: "options" as const, default: "sendMessage", options: [
        { name: "Send Message", value: "sendMessage" }, { name: "Send Photo", value: "sendPhoto" }, { name: "Send Document", value: "sendDocument" },
        { name: "Get Updates", value: "getUpdates" }, { name: "Set Webhook", value: "setWebhook" }, { name: "Delete Webhook", value: "deleteWebhook" }] },
      { displayName: "Chat ID", name: "chatId", type: "string" as const, default: "" },
      { displayName: "Text / Caption", name: "text", type: "string" as const, default: "" },
      { displayName: "File URL or file_id", name: "fileUrl", type: "string" as const, default: "" },
      { displayName: "Webhook URL", name: "webhookUrl", type: "string" as const, default: "" },
      { displayName: "Reply Markup (JSON)", name: "replyMarkup", type: "json" as const, default: "" },
    ],
  };

  async execute(this: ExecuteContext): Promise<Item[][]> {
    const items = this.getInputData();
    const { botToken } = await this.getCredentials("baleApi");
    const base = `https://tapi.bale.ai/bot${botToken}`;
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const op = String(this.getNodeParameter("operation", i, "sendMessage"));
      const chatId = this.getNodeParameter("chatId", i, "");
      const text = this.getNodeParameter("text", i, "");
      const fileUrl = this.getNodeParameter("fileUrl", i, "");
      const rm = this.getNodeParameter("replyMarkup", i, "");
      let body: Record<string, unknown> | undefined;
      switch (op) {
        case "sendMessage": body = { chat_id: chatId, text, ...(rm ? { reply_markup: typeof rm === "string" ? JSON.parse(rm) : rm } : {}) }; break;
        case "sendPhoto": body = { chat_id: chatId, photo: fileUrl, caption: text }; break;
        case "sendDocument": body = { chat_id: chatId, document: fileUrl, caption: text }; break;
        case "setWebhook": body = { url: this.getNodeParameter("webhookUrl", i, "") }; break;
        case "deleteWebhook": body = {}; break;
        default: body = undefined; // getUpdates
      }
      const res = await requestJson(`${base}/${op}`, body ? { method: "POST", body: JSON.stringify(body) } : { method: "GET" });
      out.push({ json: res as Record<string, unknown> });
    }
    return [out];
  }
}
