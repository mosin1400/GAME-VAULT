// ============================================================================
// Templates – قالب‌های آماده Workflow (دستی + تولیدشده)
// ============================================================================
import type { WorkflowNode, WorkflowEdge } from "@/db/schema";
import { defaultParams, NODE_CATALOG } from "@/lib/nodes/catalog";

export type Template = {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

type Step = { type: string; name?: string; params?: Record<string, unknown>; handle?: string; from?: number };

/** ساخت سریع جریان خطی/شاخه‌ای از لیست مراحل */
function chain(steps: Step[]): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const nodes: WorkflowNode[] = steps.map((s, i) => ({
    id: `n${i + 1}`,
    type: s.type,
    name: s.name ?? NODE_CATALOG.find((n) => n.type === s.type)?.name ?? s.type,
    position: { x: 80 + i * 260, y: 200 + (s.from !== undefined && s.handle === "false" ? 160 : 0) },
    parameters: { ...defaultParams(s.type), ...(s.params ?? {}) },
  }));
  const edges: WorkflowEdge[] = steps
    .map((s, i) => (i === 0 ? null : { id: `e${i}`, source: `n${(s.from ?? i - 1) + 1}`, target: `n${i + 1}`, sourceHandle: s.handle ?? "main", targetHandle: "in0" }))
    .filter(Boolean) as WorkflowEdge[];
  return { nodes, edges };
}

const T = (id: string, name: string, description: string, category: string, tags: string[], steps: Step[]): Template => ({ id, name, description, category, tags, ...chain(steps) });

export const HANDCRAFTED: Template[] = [
  T("welcome-demo", "دموی خوش‌آمد: HTTP → Set → If", "دریافت داده از API عمومی، تبدیل، و شاخه‌بندی شرطی", "شروع", ["demo", "http", "if"], [
    { type: "manualTrigger", params: { payload: '{"userId": 1}' } },
    { type: "httpRequest", params: { url: "https://jsonplaceholder.typicode.com/todos/{{ $json.userId }}" } },
    { type: "set", params: { fields: '{"title": "={{ $json.body.title }}", "completed": "={{ $json.body.completed }}", "checkedAt": "={{ $now }}"}' } },
    { type: "if", params: { condition: "={{ $json.completed === true }}" } },
    { type: "set", name: "Done Branch", params: { fields: '{"status": "انجام شده ✅"}' }, handle: "true", from: 3 },
    { type: "set", name: "Pending Branch", params: { fields: '{"status": "در انتظار ⏳"}' }, handle: "false", from: 3 },
  ]),
  T("bale-daily-report", "گزارش روزانه به بله", "هر روز ساعت ۹ صبح داده از دیتابیس خوانده و در بله ارسال می‌شود", "پیام‌رسان", ["bale", "schedule", "postgres"], [
    { type: "scheduleTrigger", params: { cron: "0 9 * * *" } },
    { type: "postgres", params: { query: "SELECT count(*) AS total, status FROM executions GROUP BY status" } },
    { type: "aggregate" },
    { type: "code", params: { code: "const rows = $json.data;\nconst text = '📊 گزارش روزانه FlowForge\\n' + rows.map(r => `• ${r.status}: ${r.total}`).join('\\n');\nreturn [{ json: { text, chatId: $vars.BALE_CHAT_ID || '123' } }];" } },
    { type: "bale", params: { chatId: "={{ $json.chatId }}", text: "={{ $json.text }}" } },
  ]),
  T("telegram-ai-bot", "ربات تلگرام با AI Agent", "دریافت پیام از تلگرام، پاسخ با AI Agent دارای حافظه و Guardrails", "هوش مصنوعی", ["telegram", "ai", "agent"], [
    { type: "telegramTrigger" },
    { type: "set", params: { fields: '{"message": "={{ $json.message?.text || $json.text }}", "chatId": "={{ $json.message?.chat?.id || $json.chatId }}", "sessionId": "={{ String($json.message?.chat?.id || \'demo\') }}"}' } },
    { type: "aiAgent", params: { prompt: "={{ $json.message }}", memoryKey: "={{ $json.sessionId }}" } },
    { type: "guardrails", params: { text: "={{ $json.output }}" } },
    { type: "telegram", params: { chatId: "={{ $json.chatId }}", text: "={{ $json.output }}" }, handle: "pass" },
  ]),
  T("rag-pipeline", "پایپ‌لاین کامل RAG", "بارگذاری سند → تقسیم → Embedding → Vector Store → پرسش و پاسخ", "هوش مصنوعی", ["rag", "vector", "llm"], [
    { type: "manualTrigger", params: { payload: '{"question": "FlowForge چیست؟"}' } },
    { type: "set", params: { fields: '{"text": "FlowForge یک پلتفرم اتوماسیون کاری متن‌باز است که روی Docker اجرا می‌شود و از AI Agent، RAG، پیام‌رسان‌های بله و سروش، MQTT و Modbus پشتیبانی می‌کند. این پلتفرم بیش از ۵۰۰ نود دارد."}' } },
    { type: "textSplitter", params: { chunkSize: 120, overlap: 20 } },
    { type: "embeddings", params: { provider: "local" } },
    { type: "vectorStore", params: { operation: "insert", collection: "docs" } },
    { type: "ragChain", params: { collection: "docs", question: "={{ $node['Manual Trigger'].json.question }}" } },
  ]),
  T("webhook-to-sheets", "Webhook → Google Sheets + Slack", "دریافت فرم از Webhook، ثبت در Google Sheets و اطلاع‌رسانی Slack", "یکپارچه‌سازی", ["webhook", "google", "slack"], [
    { type: "webhookTrigger", params: { path: "lead" } },
    { type: "set", params: { fields: '{"name": "={{ $json.body?.name || $json.name }}", "email": "={{ $json.body?.email || $json.email }}", "receivedAt": "={{ $now }}"}' } },
    { type: "googleSheets.sheetRow", params: { operation: "create", simulate: true } },
    { type: "slack", params: { text: "🆕 لید جدید: {{ $json.input?.name || $json.name }}" } },
    { type: "respondToWebhook", params: { body: '{"ok": true}' } },
  ]),
  T("iot-mqtt-modbus", "مانیتورینگ صنعتی: Modbus → If → MQTT", "خواندن رجیستر از PLC، بررسی آستانه و انتشار هشدار روی MQTT", "IoT", ["modbus", "mqtt", "iot"], [
    { type: "scheduleTrigger", params: { cron: "* * * * *" } },
    { type: "modbus", params: { host: "192.168.1.10", function: "readHolding", address: 0, quantity: 2 } },
    { type: "if", params: { condition: "={{ ($json.values?.[0] ?? 0) > 80 }}" } },
    { type: "mqtt", params: { topic: "factory/alerts", message: '={{ JSON.stringify({ alert: "high_temp", values: $json.values }) }}' }, handle: "true" },
    { type: "logStream", params: { message: "={{ 'OK: ' + JSON.stringify($json.values) }}" }, handle: "false", from: 2 },
  ]),
  T("loop-batch-api", "پردازش دسته‌ای با Loop", "دریافت لیست، پردازش هر آیتم در حلقه و تجمیع نتایج", "داده", ["loop", "batch"], [
    { type: "manualTrigger", params: { payload: '{"ids": [1,2,3]}' } },
    { type: "splitOut", params: { field: "ids" } },
    { type: "loop", params: { batchSize: 1 } },
    { type: "httpRequest", params: { url: "https://jsonplaceholder.typicode.com/posts/{{ $json.value }}" }, handle: "loop" },
    { type: "set", params: { fields: '{"title": "={{ $json.body.title }}"}' } },
    { type: "aggregate", from: 2, handle: "done" },
  ]),
  T("file-watcher-backup", "پشتیبان‌گیری فایل به S3/MinIO", "با ورود فایل جدید به پوشه، فشرده‌سازی و آپلود به MinIO", "فایل", ["file", "s3", "minio"], [
    { type: "fileTrigger", params: { path: "/files/inbox" } },
    { type: "readWriteFile", params: { operation: "read", path: "={{ $json.path || '/files/inbox/sample.txt' }}" } },
    { type: "compression", params: { value: "={{ $json.content }}" } },
    { type: "s3", params: { operation: "put", key: "backup/{{ $now }}.gz", content: "={{ $json.compressed }}" } },
  ]),
  T("error-notifier", "Error Workflow: اطلاع‌رسانی خطا", "با خطا در هر جریان، پیام به بله/تلگرام و ثبت لاگ", "مدیریت", ["error", "monitoring"], [
    { type: "errorTrigger" },
    { type: "set", params: { fields: '{"text": "🚨 خطا در {{ $json.workflow?.name }}: {{ $json.execution?.error }}", "chatId": "={{ $vars.ALERT_CHAT_ID || \'0\' }}"}' } },
    { type: "bale" },
    { type: "logStream", params: { level: "error" } },
  ]),
  T("hitl-approval", "تأیید انسانی قبل از پرداخت", "درخواست پرداخت → Guardrails → تأیید انسانی → Stripe", "سازمانی", ["hitl", "stripe", "approval"], [
    { type: "webhookTrigger", params: { path: "payment" } },
    { type: "humanApproval", params: { message: "پرداخت {{ $json.body?.amount }} تأیید شود؟" } },
    { type: "stripe.paymentIntent", params: { operation: "create", simulate: true }, handle: "approved" },
    { type: "sendEmail", params: { subject: "پرداخت رد شد" }, handle: "rejected", from: 1 },
  ]),
  T("db-cdc-sync", "همگام‌سازی CDC به CRM", "با درج رکورد در جدول، مشتری در HubSpot ساخته می‌شود", "دیتابیس", ["cdc", "postgres", "hubspot"], [
    { type: "dbTrigger", params: { table: "customers" } },
    { type: "hubspot.contact", params: { operation: "create", simulate: true } },
    { type: "postgres", params: { query: "SELECT now() AS synced_at" } },
  ]),
  T("rss-summarize-discord", "خلاصه اخبار RSS با LLM → Discord", "هر ساعت فید RSS خوانده، با LLM خلاصه و در Discord ارسال می‌شود", "محتوا", ["rss", "llm", "discord"], [
    { type: "scheduleTrigger", params: { cron: "0 * * * *" } },
    { type: "rss", params: { url: "https://hnrss.org/frontpage" } },
    { type: "limit", params: { max: 5 } },
    { type: "aggregate" },
    { type: "llmChat", params: { prompt: "این عناوین را در ۳ خط خلاصه کن:\n{{ JSON.stringify($json.data.map(d => d.title)) }}" } },
    { type: "discord", params: { content: "={{ $json.output }}" } },
  ]),
  T("bash-devops", "DevOps: Bash + Docker + GitHub", "اجرای اسکریپت، بررسی کانتینرها و ثبت Issue در صورت خطا", "DevOps", ["bash", "docker", "github"], [
    { type: "scheduleTrigger", params: { cron: "*/15 * * * *" } },
    { type: "bash", params: { script: "df -h / | tail -1 | awk '{print $5}' | tr -d '%'" } },
    { type: "if", params: { condition: "={{ Number($json.stdout) > 90 }}" } },
    { type: "gitHub.issue", params: { operation: "create", simulate: true }, handle: "true" },
  ]),
  T("soroush-support-classifier", "دسته‌بندی پیام‌های سروش", "دریافت پیام از سروش، دسته‌بندی و مسیریابی با Switch", "پیام‌رسان", ["soroush", "classifier", "switch"], [
    { type: "soroushTrigger" },
    { type: "textClassifier", params: { text: "={{ $json.text || $json.body }}" } },
    { type: "switch", params: { value: "={{ $json.category }}", rules: '["support","sales","other"]' } },
    { type: "soroush", name: "Support Reply", params: { text: "به پشتیبانی ارجاع شد" }, handle: "0" },
    { type: "soroush", name: "Sales Reply", params: { text: "به فروش ارجاع شد" }, handle: "1", from: 2 },
  ]),
  T("websocket-tcp-bridge", "پل WebSocket ↔ TCP", "دریافت پیام WebSocket و ارسال روی سوکت TCP لوکال", "IoT", ["websocket", "tcp"], [
    { type: "websocketTrigger" },
    { type: "tcp", params: { host: "127.0.0.1", port: 9000 } },
    { type: "udp", params: { port: 9001 } },
  ]),
  T("export-csv-email", "خروجی CSV و ارسال ایمیل", "کوئری دیتابیس → CSV → ایمیل", "داده", ["csv", "email", "export"], [
    { type: "manualTrigger" },
    { type: "postgres", params: { query: "SELECT id, name, active, created_at FROM workflows" } },
    { type: "convertToFile", params: { format: "csv", fileName: "workflows.csv" } },
    { type: "sendEmail", params: { to: "admin@example.com", subject: "خروجی CSV", html: "فایل {{ $json.fileName }} با {{ $json.rows }} ردیف ساخته شد." } },
  ]),
  T("subworkflow-orchestrator", "ارکستراسیون Sub-workflow", "فراخوانی جریان‌های دیگر و ادغام نتایج", "هسته", ["subworkflow", "merge"], [
    { type: "manualTrigger", params: { payload: '{"order": 42}' } },
    { type: "executeWorkflow", params: { workflowId: 1 } },
    { type: "merge" },
  ]),
];

// افزودن back-edge برای قالب حلقه (اتصال خروجی بدنه به نود Loop)
HANDCRAFTED.find((t) => t.id === "loop-batch-api")?.edges.push({ id: "eback", source: "n5", target: "n3", sourceHandle: "main", targetHandle: "in0" });

/** قالب‌های تولیدشده: تریگر × یکپارچه‌سازی × اقدام */
function generated(): Template[] {
  const out: Template[] = [];
  const triggers = [
    { type: "webhookTrigger", label: "Webhook" },
    { type: "scheduleTrigger", label: "زمان‌بندی" },
    { type: "manualTrigger", label: "دستی" },
  ];
  const actions = [
    { type: "bale", label: "اطلاع‌رسانی بله" },
    { type: "telegram", label: "اطلاع‌رسانی تلگرام" },
    { type: "sendEmail", label: "ایمیل" },
    { type: "postgres", label: "ثبت در PostgreSQL" },
    { type: "slack", label: "پیام Slack" },
  ];
  const integrations = NODE_CATALOG.filter((n) => n.handler === "genericApi" && !n.trigger);
  const seen = new Set<string>();
  for (const integ of integrations) {
    const key = String(integ.meta?.integration);
    if (seen.has(key)) continue;
    seen.add(key);
    const t = triggers[out.length % triggers.length];
    const a = actions[out.length % actions.length];
    out.push(T(`gen-${integ.type}`, `${key} → ${a.label}`, `${t.label} → دریافت ${integ.meta?.resource} از ${key} → ${a.label}`, integ.category, ["generated", key.toLowerCase()], [
      { type: t.type },
      { type: integ.type, params: { operation: "getAll", simulate: true } },
      { type: "set", params: { fields: '{"text": "={{ JSON.stringify($json.result || $json.body).slice(0, 200) }}"}' } },
      { type: a.type },
    ]));
    // نسخه دوم: با شرط و AI
    out.push(T(`gen-ai-${integ.type}`, `${key} + تحلیل AI`, `${key} → LLM → If → ${a.label}`, integ.category, ["generated", "ai", key.toLowerCase()], [
      { type: "scheduleTrigger" },
      { type: integ.type, params: { operation: "getAll", simulate: true } },
      { type: "llmChat", params: { prompt: "داده زیر را تحلیل کن و مهم‌ترین نکته را بگو:\n{{ JSON.stringify($json) }}" } },
      { type: "if", params: { condition: "={{ ($json.output || '').length > 0 }}" } },
      { type: a.type, params: { text: "={{ $json.output }}" }, handle: "true" },
    ]));
    {
      out.push(T(`gen-sync-${integ.type}`, `همگام‌سازی ${key} با دیتابیس`, `Polling ${key} → حذف تکراری → ثبت در PostgreSQL`, integ.category, ["generated", "sync", key.toLowerCase()], [
        { type: "pollingTrigger" },
        { type: integ.type, params: { operation: "getAll", simulate: true } },
        { type: "removeDuplicates" },
        { type: "postgres", params: { query: "SELECT 1" } },
      ]));
    }
  }
  return out;
}

export const TEMPLATES: Template[] = [...HANDCRAFTED, ...generated()];
export const TEMPLATE_COUNT = TEMPLATES.length;
