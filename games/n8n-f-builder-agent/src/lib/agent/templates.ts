/**
 * موتور قالب‌محور (Heuristic Engine)
 * -----------------------------------
 * وقتی هیچ ارائه‌دهندهٔ مدل (Codex CLI / API / n8n proxy) در دسترس نباشد،
 * این موتور با تحلیل کلیدواژه‌ای درخواست، یک Workflow معتبر می‌سازد.
 * همچنین به‌عنوان «شبکهٔ ایمنی» در Self-Heal استفاده می‌شود.
 */
import type { N8nNode, N8nWorkflow } from "./types";

/** نیت‌های قابل تشخیص */
export type Intent =
  | "bale-codex-translate"
  | "bale-codex-chat"
  | "bale-echo"
  | "webhook-codex"
  | "schedule-codex-bale"
  | "generic-webhook";

/** تحلیل نیت از روی کلیدواژه‌ها (فارسی + انگلیسی) */
export function detectIntent(prompt: string): Intent {
  const p = prompt.toLowerCase();
  const hasBale = /بله|bale/.test(p);
  const hasCodex = /کدکس|codex|هوش مصنوعی|ai|gpt|مدل/.test(p);
  const hasTranslate = /ترجمه|translat/.test(p);
  const hasSchedule = /هر روز|روزانه|هر ساعت|ساعتی|زمان‌بندی|زمانبندی|schedule|daily|hourly|cron|هفتگی/.test(p);
  const hasWebhook = /وبهوک|webhook|api|اندپوینت|endpoint/.test(p);

  if (hasSchedule && hasBale) return "schedule-codex-bale";
  if (hasBale && hasTranslate) return "bale-codex-translate";
  if (hasBale && hasCodex) return "bale-codex-chat";
  if (hasBale) return "bale-echo";
  if (hasWebhook && hasCodex) return "webhook-codex";
  if (hasCodex) return "webhook-codex";
  return "generic-webhook";
}

/** استخراج «دستور سیستمی» برای مدل از متن درخواست */
function deriveSystemMessage(prompt: string, intent: Intent): string {
  switch (intent) {
    case "bale-codex-translate":
      return "You are a professional translator. Detect the language of the incoming text; if it is Persian translate it to English, otherwise translate it to fluent Persian. Reply ONLY with the translation.";
    case "schedule-codex-bale":
      return `You are an assistant that produces a concise report/message for the user based on this instruction: "${prompt}". Write in Persian.`;
    default:
      return `You are a helpful assistant. Follow the user's original request: "${prompt}". Always answer in the same language as the user's message.`;
  }
}

/* ---------- سازنده‌های نود (برای خوانایی) ---------- */

const baleTrigger = (): N8nNode => ({
  name: "Bale Trigger",
  type: "n8n-nodes-bale.baleTrigger",
  typeVersion: 1,
  position: [0, 0],
  parameters: { updates: ["message"] },
  credentials: { baleApi: { name: "Bale account" } },
});

const codexModel = (x: number): N8nNode => ({
  name: "Codex Chat Model",
  type: "@chrishdx/n8n-nodes-codex-cli-lm.codexCliLm",
  typeVersion: 1,
  position: [x, 200],
  parameters: { model: "gpt-5-codex" },
});

const aiAgent = (x: number, text: string, systemMessage: string): N8nNode => ({
  name: "AI Agent",
  type: "@n8n/n8n-nodes-langchain.agent",
  typeVersion: 1.7,
  position: [x, 0],
  parameters: { promptType: "define", text, options: { systemMessage } },
});

const baleSend = (x: number, chatId: string, text: string): N8nNode => ({
  name: "Send Bale Message",
  type: "n8n-nodes-bale.bale",
  typeVersion: 1,
  position: [x, 0],
  parameters: { resource: "message", operation: "sendMessage", chatId, text },
  credentials: { baleApi: { name: "Bale account" } },
});

const webhook = (path: string): N8nNode => ({
  name: "Webhook",
  type: "n8n-nodes-base.webhook",
  typeVersion: 2,
  position: [0, 0],
  parameters: { path, httpMethod: "POST", responseMode: "responseNode" },
});

const respond = (x: number, body: string): N8nNode => ({
  name: "Respond to Webhook",
  type: "n8n-nodes-base.respondToWebhook",
  typeVersion: 1.1,
  position: [x, 0],
  parameters: { respondWith: "json", responseBody: body },
});

/** تولید slug انگلیسی از متن درخواست */
function slug(prompt: string): string {
  const s = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return s.length >= 3 ? s.slice(0, 40) : `auto-${Date.now().toString(36)}`;
}

/** ساخت Workflow از روی نیت */
export function buildFromTemplate(prompt: string): { workflow: N8nWorkflow; explanation: string } {
  const intent = detectIntent(prompt);
  const systemMessage = deriveSystemMessage(prompt, intent);
  const chatIdExpr = "={{ $('Bale Trigger').item.json.message.chat.id }}";

  switch (intent) {
    case "bale-codex-translate":
    case "bale-codex-chat": {
      const name =
        intent === "bale-codex-translate" ? "Bale Translator Bot (Codex)" : "Bale Codex Assistant Bot";
      return {
        explanation:
          intent === "bale-codex-translate"
            ? "بات بله: هر پیام دریافتی به Codex ارسال و ترجمهٔ آن به کاربر برگردانده می‌شود."
            : "بات بله: هر پیام دریافتی به Codex ارسال و پاسخ مدل به کاربر برگردانده می‌شود.",
        workflow: {
          name,
          nodes: [
            baleTrigger(),
            aiAgent(220, "={{ $json.message.text }}", systemMessage),
            codexModel(220),
            baleSend(440, chatIdExpr, "={{ $json.output }}"),
          ],
          connections: {
            "Bale Trigger": { main: [[{ node: "AI Agent", type: "main", index: 0 }]] },
            "Codex Chat Model": {
              ai_languageModel: [[{ node: "AI Agent", type: "ai_languageModel", index: 0 }]],
            },
            "AI Agent": { main: [[{ node: "Send Bale Message", type: "main", index: 0 }]] },
          },
          settings: { executionOrder: "v1" },
        },
      };
    }

    case "bale-echo":
      return {
        explanation: "بات بله: هر پیام دریافتی عیناً به کاربر بازگردانده می‌شود.",
        workflow: {
          name: "Bale Echo Bot",
          nodes: [baleTrigger(), baleSend(220, chatIdExpr, "={{ $json.message.text }}")],
          connections: {
            "Bale Trigger": { main: [[{ node: "Send Bale Message", type: "main", index: 0 }]] },
          },
          settings: { executionOrder: "v1" },
        },
      };

    case "schedule-codex-bale":
      return {
        explanation: "زمان‌بندی: در بازه‌های مشخص Codex یک پیام تولید و در بله ارسال می‌کند.",
        workflow: {
          name: "Scheduled Codex Report to Bale",
          nodes: [
            {
              name: "Schedule Trigger",
              type: "n8n-nodes-base.scheduleTrigger",
              typeVersion: 1.2,
              position: [0, 0],
              parameters: {
                rule: {
                  interval: [
                    /هر ساعت|ساعتی|hourly/.test(prompt)
                      ? { field: "hours", hoursInterval: 1 }
                      : { field: "days", daysInterval: 1, triggerAtHour: 9 },
                  ],
                },
              },
            },
            aiAgent(220, "Generate the scheduled message now.", systemMessage),
            codexModel(220),
            baleSend(440, "={{ $env.BALE_DEFAULT_CHAT_ID }}", "={{ $json.output }}"),
          ],
          connections: {
            "Schedule Trigger": { main: [[{ node: "AI Agent", type: "main", index: 0 }]] },
            "Codex Chat Model": {
              ai_languageModel: [[{ node: "AI Agent", type: "ai_languageModel", index: 0 }]],
            },
            "AI Agent": { main: [[{ node: "Send Bale Message", type: "main", index: 0 }]] },
          },
          settings: { executionOrder: "v1" },
        },
      };

    case "webhook-codex":
      return {
        explanation: "Webhook: بدنهٔ درخواست به Codex داده می‌شود و پاسخ به‌صورت JSON برمی‌گردد.",
        workflow: {
          name: "Webhook → Codex API",
          nodes: [
            webhook(slug(prompt)),
            aiAgent(220, "={{ $json.body.text || JSON.stringify($json.body) }}", systemMessage),
            codexModel(220),
            respond(440, '={{ { "reply": $json.output } }}'),
          ],
          connections: {
            Webhook: { main: [[{ node: "AI Agent", type: "main", index: 0 }]] },
            "Codex Chat Model": {
              ai_languageModel: [[{ node: "AI Agent", type: "ai_languageModel", index: 0 }]],
            },
            "AI Agent": { main: [[{ node: "Respond to Webhook", type: "main", index: 0 }]] },
          },
          settings: { executionOrder: "v1" },
        },
      };

    default:
      return {
        explanation: "Webhook عمومی: دادهٔ ورودی پردازش و بازگردانده می‌شود.",
        workflow: {
          name: `Automation: ${prompt.slice(0, 40)}`,
          nodes: [
            webhook(slug(prompt)),
            {
              name: "Process",
              type: "n8n-nodes-base.code",
              typeVersion: 2,
              position: [220, 0],
              parameters: {
                jsCode: `// درخواست اصلی کاربر: ${prompt.replace(/\n/g, " ")}\nreturn $input.all().map(i => ({ json: { received: i.json.body ?? i.json, processedAt: new Date().toISOString() } }));`,
              },
            },
            respond(440, "={{ $json }}"),
          ],
          connections: {
            Webhook: { main: [[{ node: "Process", type: "main", index: 0 }]] },
            Process: { main: [[{ node: "Respond to Webhook", type: "main", index: 0 }]] },
          },
          settings: { executionOrder: "v1" },
        },
      };
  }
}
