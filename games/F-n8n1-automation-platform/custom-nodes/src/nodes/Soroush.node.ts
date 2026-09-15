// ============================================================================
// Soroush Plus Node – ارسال متن/فایل و دریافت پیام از سروش پلاس
// API: https://bot.splus.ir/<TOKEN>/<method>
// ============================================================================
import { type INodeType, type ExecuteContext, type Item, requestJson } from "../types";

export class Soroush implements INodeType {
  description = {
    displayName: "Soroush Plus",
    name: "soroush",
    group: ["output" as const],
    version: 1,
    description: "ارسال و دریافت پیام در سروش پلاس",
    icon: "file:soroush.svg",
    defaults: { name: "Soroush", color: "#2563eb" },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [{ name: "soroushApi", required: true }],
    properties: [
      { displayName: "Operation", name: "operation", type: "options" as const, default: "sendMessage", options: [
        { name: "Send Message", value: "sendMessage" }, { name: "Send File", value: "sendFile" }, { name: "Get Updates", value: "getUpdates" }] },
      { displayName: "Chat ID", name: "chatId", type: "string" as const, default: "" },
      { displayName: "Text / Caption", name: "text", type: "string" as const, default: "" },
      { displayName: "File URL", name: "fileUrl", type: "string" as const, default: "" },
    ],
  };

  async execute(this: ExecuteContext): Promise<Item[][]> {
    const items = this.getInputData();
    const { botToken } = await this.getCredentials("soroushApi");
    const base = `https://bot.splus.ir/${botToken}`;
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const op = String(this.getNodeParameter("operation", i, "sendMessage"));
      const to = this.getNodeParameter("chatId", i, "");
      const text = this.getNodeParameter("text", i, "");
      if (op === "getUpdates") { out.push({ json: (await requestJson(`${base}/getUpdates`)) as Record<string, unknown> }); continue; }
      const body = op === "sendFile" ? { to, url: this.getNodeParameter("fileUrl", i, ""), caption: text } : { to, body: text };
      out.push({ json: (await requestJson(`${base}/${op}`, { method: "POST", body: JSON.stringify(body) })) as Record<string, unknown> });
    }
    return [out];
  }
}
