/**
 * دستورالعمل سیستم (System Instruction) مغز Agent
 * -------------------------------------------------
 * این متن دقیقاً همان چیزی است که به Codex (یا هر مدل دیگر) داده می‌شود
 * تا درخواست زبان طبیعی را به یک Workflow قابل اجرا در n8n تبدیل کند.
 */
import type { KnowledgeEntry } from "@/db/schema";

/** نودهایی که مدل اجازه دارد از آن‌ها استفاده کند (کاتالوگ نودهای مجاز) */
export const ALLOWED_NODE_CATALOG = [
  {
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    desc: "دریافت HTTP از بیرون. parameters: { path, httpMethod, responseMode: 'responseNode' | 'onReceived' }",
  },
  {
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.1,
    desc: "پاسخ به Webhook. parameters: { respondWith: 'json' | 'text', responseBody }",
  },
  {
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    desc: "درخواست HTTP. parameters: { method, url, sendBody, specifyBody: 'json', jsonBody }",
  },
  {
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    desc: "تنظیم فیلدها. parameters: { assignments: { assignments: [{ id, name, value, type }] } }",
  },
  {
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    desc: "کد JavaScript. parameters: { jsCode }",
  },
  {
    type: "n8n-nodes-base.if",
    typeVersion: 2,
    desc: "شرط. parameters: { conditions: {...} }",
  },
  {
    type: "n8n-nodes-base.scheduleTrigger",
    typeVersion: 1.2,
    desc: "زمان‌بندی. parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1 }] } }",
  },
  {
    type: "@n8n/n8n-nodes-langchain.agent",
    typeVersion: 1.7,
    desc: "AI Agent. parameters: { promptType: 'define', text, options: { systemMessage } } — مدل زبانی از طریق اتصال ai_languageModel به آن وصل می‌شود",
  },
  {
    type: "@n8n/n8n-nodes-langchain.chainLlm",
    typeVersion: 1.5,
    desc: "زنجیرهٔ سادهٔ LLM. parameters: { promptType: 'define', text }",
  },
  {
    type: "@chrishdx/n8n-nodes-codex-cli-lm.codexCliLm",
    typeVersion: 1,
    desc: "Codex Chat Model (اشتراک ChatGPT/Codex کاربر). parameters: { model: 'gpt-5-codex' } — خروجی آن با type='ai_languageModel' به AI Agent یا Chain وصل می‌شود",
  },
  {
    type: "n8n-nodes-bale.baleTrigger",
    typeVersion: 1,
    desc: "Trigger پیام‌رسان بله (Webhook خودکار). parameters: { updates: ['message'] } ، credentials: { baleApi: { name: 'Bale account' } }. خروجی: { message: { chat: { id }, text, from } }",
  },
  {
    type: "n8n-nodes-bale.bale",
    typeVersion: 1,
    desc: "ارسال پیام/عکس/فایل در بله. parameters: { resource: 'message', operation: 'sendMessage', chatId, text } ، credentials: { baleApi: { name: 'Bale account' } }",
  },
  {
    type: "n8n-nodes-bale.workflowBuilder",
    typeVersion: 1,
    desc: "ابزار سازندهٔ Workflow (اعتبارسنجی + ساخت + فعال‌سازی از طریق API n8n). parameters: { workflowJson, activate: true }",
  },
] as const;

/** متن اصلی دستورالعمل */
export const SYSTEM_INSTRUCTION = `تو یک متخصص ساخت اتوماسیون با n8n هستی. وظیفه‌ات این است که درخواست‌های کاربر را به یک Workflow دقیق و قابل اجرا در n8n تبدیل کنی.

قوانین سخت‌گیرانه:
1. خروجی تو باید **فقط** یک شیء JSON باشد که دقیقاً منطبق با ساختار Workflow در n8n است؛ بدون هیچ متن اضافه، بدون بلوک markdown.
2. ساختار خروجی:
{
  "name": "نام کوتاه و گویا",
  "nodes": [ { "name", "type", "typeVersion", "position": [x, y], "parameters": {...}, "credentials"?: {...} } ],
  "connections": { "<نام نود مبدا>": { "main": [ [ { "node": "<نام نود مقصد>", "type": "main", "index": 0 } ] ] } },
  "settings": { "executionOrder": "v1" }
}
3. همیشه از نودهای موجود در کاتالوگ زیر استفاده کن (HTTP Request، Webhook، Codex Chat Model، و نودهای سفارشی بله/سروش). نود ناشناخته ممنوع است.
4. هر Workflow باید دقیقاً یک نود Trigger داشته باشد (webhook / baleTrigger / scheduleTrigger).
5. برای اتصال مدل زبانی به AI Agent از connection با type "ai_languageModel" استفاده کن:
   "Codex Chat Model": { "ai_languageModel": [ [ { "node": "AI Agent", "type": "ai_languageModel", "index": 0 } ] ] }
6. برای دسترسی به دادهٔ نود قبلی از عبارات n8n استفاده کن: ={{ $json.message.text }} یا ={{ $('Bale Trigger').item.json.message.chat.id }}
7. نام نودها باید یکتا و انگلیسی باشد؛ مختصات را با فاصلهٔ ۲۲۰ پیکسل افقی بچین.
8. برای پاسخ‌دادن به کاربر بله، همیشه chatId را از خروجی Bale Trigger بخوان.
9. اگر درخواست مبهم بود، منطقی‌ترین برداشت را انتخاب کن و هرگز سؤال نپرس.

کاتالوگ نودهای مجاز:
${ALLOWED_NODE_CATALOG.map((n) => `- ${n.type} (v${n.typeVersion}): ${n.desc}`).join("\n")}
`;

/** نمونهٔ few-shot ثابت: بات بله متصل به Codex برای ترجمه */
export const FEW_SHOT_EXAMPLE = {
  prompt: "یک بات بله بساز که به کدکس وصل باشه و هر چی بگم رو ترجمه کنه",
  workflow: {
    name: "Bale Translator Bot (Codex)",
    nodes: [
      {
        name: "Bale Trigger",
        type: "n8n-nodes-bale.baleTrigger",
        typeVersion: 1,
        position: [0, 0],
        parameters: { updates: ["message"] },
        credentials: { baleApi: { name: "Bale account" } },
      },
      {
        name: "AI Agent",
        type: "@n8n/n8n-nodes-langchain.agent",
        typeVersion: 1.7,
        position: [220, 0],
        parameters: {
          promptType: "define",
          text: "={{ $json.message.text }}",
          options: {
            systemMessage:
              "You are a translator. Detect the language; if Persian translate to English, otherwise translate to Persian. Reply only with the translation.",
          },
        },
      },
      {
        name: "Codex Chat Model",
        type: "@chrishdx/n8n-nodes-codex-cli-lm.codexCliLm",
        typeVersion: 1,
        position: [220, 200],
        parameters: { model: "gpt-5-codex" },
      },
      {
        name: "Send Reply",
        type: "n8n-nodes-bale.bale",
        typeVersion: 1,
        position: [440, 0],
        parameters: {
          resource: "message",
          operation: "sendMessage",
          chatId: "={{ $('Bale Trigger').item.json.message.chat.id }}",
          text: "={{ $json.output }}",
        },
        credentials: { baleApi: { name: "Bale account" } },
      },
    ],
    connections: {
      "Bale Trigger": { main: [[{ node: "AI Agent", type: "main", index: 0 }]] },
      "Codex Chat Model": {
        ai_languageModel: [[{ node: "AI Agent", type: "ai_languageModel", index: 0 }]],
      },
      "AI Agent": { main: [[{ node: "Send Reply", type: "main", index: 0 }]] },
    },
    settings: { executionOrder: "v1" },
  },
};

/**
 * ساخت پیام کاربر برای مدل — شامل نمونه‌های بازیابی‌شده از پایگاه دانش
 * (این همان مکانیزم «خودتکامل‌شوندگی» است: هر بار موفقیت، نمونه‌های بهتری تزریق می‌شود)
 */
export function buildUserPrompt(
  request: string,
  knowledge: KnowledgeEntry[],
  previousError?: string,
): string {
  const parts: string[] = [];

  parts.push("### نمونهٔ مرجع\nدرخواست: " + FEW_SHOT_EXAMPLE.prompt);
  parts.push("خروجی:\n" + JSON.stringify(FEW_SHOT_EXAMPLE.workflow));

  const successes = knowledge.filter((k) => k.kind === "success_pattern").slice(0, 2);
  for (const k of successes) {
    parts.push(`### نمونهٔ موفق قبلی\nدرخواست: ${k.prompt}\nخروجی:\n${JSON.stringify(k.workflowJson)}`);
  }

  const lessons = knowledge.filter((k) => k.kind === "error_fix" && k.lesson);
  if (lessons.length) {
    parts.push(
      "### درس‌های آموخته‌شده از خطاهای قبلی (حتماً رعایت کن)\n" +
        lessons.map((l) => `- ${l.lesson}`).join("\n"),
    );
  }

  if (previousError) {
    parts.push(
      `### توجه: نسخهٔ قبلی این Workflow با خطای زیر مواجه شد. آن را برطرف کن:\n${previousError}`,
    );
  }

  parts.push(`### درخواست جدید کاربر\n${request}\n\nفقط JSON خروجی بده.`);
  return parts.join("\n\n");
}
