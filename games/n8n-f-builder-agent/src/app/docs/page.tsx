/**
 * صفحهٔ مستندات راه‌اندازی و استفاده (نسخهٔ خلاصهٔ README)
 */
export default function DocsPage() {
  const Code = ({ children }: { children: string }) => (
    <pre className="mono my-3 overflow-auto rounded-lg bg-black/40 p-3 text-[12px] leading-6 text-slate-200">{children}</pre>
  );
  return (
    <article className="prose-invert mx-auto max-w-4xl space-y-8 text-sm leading-7">
      <header>
        <h1 className="text-2xl font-extrabold">مستندات راه‌اندازی</h1>
        <p className="text-slate-400">
          کد کامل نودهای سفارشی، <span className="mono">docker-compose.yml</span> و Workflow الگو در پوشهٔ <span className="mono">n8n/</span> مخزن قرار دارد.
        </p>
      </header>

      <section className="panel p-6">
        <h2 className="text-lg font-bold">۱. معماری</h2>
        <ol className="mt-2 list-decimal space-y-1 pr-5">
          <li><b>ورودی</b>: <span className="mono">POST /api/webhook/bale</span>، <span className="mono">POST /api/webhook/soroush</span>، فرم وب داشبورد، <span className="mono">POST /api/webhook/n8n</span> (از نود ورودی n8n)</li>
          <li><b>مغز Agent</b>: دستورالعمل سیستم + نمونه‌های پایگاه دانش → Codex (CLI با اشتراک شما / نود Codex در n8n / API) → JSON Workflow</li>
          <li><b>سازندهٔ Workflow</b>: اعتبارسنجی Schema (zod) → <span className="mono">POST /api/v1/workflows</span> → id + لینک</li>
          <li><b>اجراکننده و مانیتور</b>: <span className="mono">POST /api/v1/workflows/:id/activate</span> → بررسی <span className="mono">/api/v1/executions</span> → Self-Heal با بازتولید و <span className="mono">PUT</span></li>
        </ol>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold">۲. متغیرهای محیطی</h2>
        <Code>{`# --- Codex (مغز Agent) ---
CODEX_MODE=auto            # auto | codex-cli | codex-n8n | openai-compatible | heuristic
CODEX_MODEL=gpt-5-codex
CODEX_BIN=codex            # مسیر باینری codex (بعد از: npm i -g @openai/codex && codex login)
N8N_CODEX_WEBHOOK_URL=     # اختیاری: Webhook ورک‌فلوی "Codex LLM Proxy" در n8n
OPENAI_API_KEY=            # اختیاری: هر API سازگار با OpenAI
OPENAI_BASE_URL=

# --- n8n (سازنده / اجراکننده) ---
N8N_BASE_URL=http://localhost:5678
N8N_PUBLIC_URL=https://n8n.example.com
N8N_API_KEY=               # Settings → n8n API → Create API key
N8N_MCP_TOKEN=             # Settings → MCP Server (اختیاری)
N8N_MCP_URL=               # پیش‌فرض: {N8N_BASE_URL}/mcp-server/http

# --- بله / سروش (ورودی) ---
BALE_BOT_TOKEN=            # از @BotFather بله
BALE_WEBHOOK_SECRET=       # اختیاری
SOROUSH_BOT_TOKEN=
PUBLIC_BASE_URL=https://agent.example.com   # آدرس عمومی همین اپ برای setWebhook

# --- امنیت / رفتار ---
AGENT_SHARED_SECRET=       # هدر X-Agent-Secret برای /api/webhook/n8n
MAX_HEAL_ATTEMPTS=3`}</Code>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold">۳. راه‌اندازی n8n با نودهای سفارشی</h2>
        <Code>{`cd n8n
cp .env.example .env         # توکن‌ها را پر کنید
docker compose up -d --build # n8n + نودهای Bale/WorkflowBuilder + پکیج Codex
# احراز هویت Codex داخل کانتینر (اشتراک ChatGPT شما):
docker compose exec n8n codex login --device-auth
# سپس در n8n: Settings → n8n API → ساخت API Key  →  در .env این اپ بگذارید
# Import کنید: n8n/workflows/automation-builder-template.json و codex-llm-proxy.json`}</Code>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold">۴. اتصال بات بله</h2>
        <Code>{`curl -X POST $PUBLIC_BASE_URL/api/bale/webhook -H 'Content-Type: application/json' \\
  -d '{"action":"set"}'
# یا مستقیم:
curl -X POST "https://tapi.bale.ai/bot$BALE_BOT_TOKEN/setWebhook" \\
  -H 'Content-Type: application/json' \\
  -d '{"url":"'$PUBLIC_BASE_URL'/api/webhook/bale"}'`}</Code>
        <p className="text-slate-400">سپس در بله به بات پیام دهید: «یک بات بله بساز که به کدکس وصل باشه و هر چی بگم رو ترجمه کنه»</p>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold">۵. تست سریع از ترمینال</h2>
        <Code>{`curl -X POST http://localhost:3000/api/agent/build -H 'Content-Type: application/json' \\
  -d '{"prompt":"یک بات بله بساز که به کدکس وصل باشه و هر چی بگم رو ترجمه کنه","wait":true}'
curl http://localhost:3000/api/agent/requests/1
curl -X POST http://localhost:3000/api/agent/requests/1/heal -d '{"error":"Bale node: chat not found"}'`}</Code>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold">۶. Self-Heal از داخل n8n</h2>
        <p className="text-slate-400">
          در n8n یک <b>Error Workflow</b> بسازید که با نود HTTP Request به <span className="mono">POST {"{APP}"}/api/agent/monitor</span> با بدنهٔ
          <span className="mono"> {'{ "workflowId": "{{$json.workflow.id}}", "error": "{{$json.execution.error.message}}" }'}</span> بزند؛ Agent همان لحظه Workflow را بازتولید و جایگزین می‌کند.
          همچنین <span className="mono">GET /api/agent/monitor</span> را می‌توانید با Schedule Trigger هر ۵ دقیقه صدا بزنید.
        </p>
      </section>
    </article>
  );
}
