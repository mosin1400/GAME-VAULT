# 🤖 Automation Builder Agent — n8n × Codex × Bale

Agent سازندهٔ اتوماسیون: درخواست زبان طبیعی شما را دریافت می‌کند، با **Codex** (از طریق اشتراک موجود شما) به یک Workflow دقیق **n8n** تبدیل می‌کند، آن را **اعتبارسنجی، ایجاد و فعال** می‌کند و در صورت خطا **خودش را ترمیم (Self-Heal)** می‌کند. هر موفقیت به حافظه اضافه می‌شود؛ بنابراین سیستم **خودتکامل‌شونده** است.

```
کاربر (بله / وب / n8n)
   │
   ▼
┌───────────── لایهٔ ۱: ورودی ─────────────┐
│ /api/webhook/bale  ·  فرم وب  ·  /api/webhook/n8n │
└───────────────────┬──────────────────────┘
                    ▼
┌───────────── لایهٔ ۲: مغز Agent ─────────┐
│ دستورالعمل سیستم + پایگاه دانش (few-shot) │
│ Codex CLI │ Codex در n8n │ OpenAI-API │ قالب │
└───────────────────┬──────────────────────┘
                    ▼  JSON Workflow
┌───────── لایهٔ ۳: سازندهٔ Workflow ──────┐
│ اعتبارسنجی Schema (zod) → POST /api/v1/workflows │
│ (نود سفارشی WorkflowBuilder / MCP Server n8n)    │
└───────────────────┬──────────────────────┘
                    ▼  id + link
┌──────── لایهٔ ۴: اجراکننده و مانیتور ────┐
│ POST /workflows/:id/activate → executions │
│ خطا؟ → بازتولید با Codex → PUT → activate │
└───────────────────┬──────────────────────┘
                    ▼
        گزارش نتیجه به کاربر در بله
```

---

## ساختار پوشه‌ها

| مسیر | محتوا |
|---|---|
| `../src/lib/agent/` | هستهٔ Agent (TypeScript): `prompt.ts` دستورالعمل، `codex.ts` اتصال Codex، `validator.ts` اعتبارسنج، `n8n.ts` کلاینت REST+MCP، `bale.ts` کلاینت بله، `builder.ts` ارکستراتور ۴ لایه + Self-Heal، `knowledge.ts` حافظهٔ خودتکامل‌شونده |
| `../src/app/api/` | Webhookها و API داشبورد |
| `custom-nodes/` | پکیج نودهای سفارشی n8n (`n8n-nodes-bale`) |
| `custom-nodes/nodes/Bale/Bale.node.ts` | نود Bale: ارسال متن/عکس/فایل، ویرایش/حذف، مدیریت Webhook |
| `custom-nodes/nodes/Bale/BaleTrigger.node.ts` | نود Bale Trigger: ثبت خودکار Webhook روی `tapi.bale.ai` |
| `custom-nodes/nodes/WorkflowBuilder/WorkflowBuilder.node.ts` | ابزار سازندهٔ Workflow (usableAsTool): validate / create / update / activate / executions / MCP |
| `custom-nodes/credentials/` | `BaleApi`, `N8nBuilderApi` |
| `workflows/automation-builder-template.json` | **Workflow اولیه (الگو)**: Webhook + Bale Trigger → AI Agent (Codex + Tool) → HTTP Request به API n8n → activate → گزارش |
| `workflows/codex-llm-proxy.json` | پروکسی Codex برای اپ Agent (وقتی Codex CLI روی سرور اپ نیست) |
| `workflows/error-monitor-self-heal.json` | Error Workflow → گزارش به Agent → Self-Heal |
| `docker-compose.yml`, `Dockerfile`, `agent.Dockerfile` | استقرار کامل |

---

## راه‌اندازی سریع (Docker)

```bash
cd n8n
cp .env.example .env            # توکن‌ها و دامنه‌ها را پر کنید
docker compose up -d --build    # postgres + n8n (با نودهای سفارشی و Codex) + agent
```

### ۱) احراز هویت Codex با اشتراک شما
```bash
docker compose exec n8n codex login --device-auth
# کد را در مرورگر وارد کنید؛ سشن در volume مشترک codex_home ذخیره می‌شود
docker compose exec n8n codex exec --skip-git-repo-check "say hi"   # تست
```
> اپ Agent هم همان volume را می‌بیند، پس `CODEX_MODE=auto` به‌طور خودکار **Codex CLI** را انتخاب می‌کند.

### ۲) ساخت API Key و MCP Token در n8n
1. وارد `http://localhost:5678` شوید و حساب Owner بسازید.
2. **Settings → n8n API → Create API key** → مقدار را در `.env` بگذارید (`N8N_API_KEY`).
3. (اختیاری) **Settings → MCP Server → Enable** → Access Token را در `N8N_MCP_TOKEN` بگذارید.
4. `docker compose up -d agent` تا اپ متغیرها را بخواند.

### ۳) اعتبارنامه‌ها در n8n
- **Bale Bot API** با نام دقیق `Bale account` (توکن از BotFather بله).
- **n8n Builder API (REST + MCP)** با نام `n8n Builder API` (Base URL: `http://localhost:5678`).
- **Header Auth** با نام `n8n API Key (X-N8N-API-KEY)` — Name: `X-N8N-API-KEY`, Value: کلید API.

### ۴) Import کردن Workflowهای الگو
در n8n: **Workflows → Import from file** برای هر سه فایل پوشهٔ `workflows/`. سپس:
- `🤖 Automation Builder Agent (Template)` را **Activate** کنید (Bale Trigger خودش Webhook را ثبت می‌کند).
- `🧠 Codex LLM Proxy` را Activate کنید (اپ با `N8N_CODEX_WEBHOOK_URL` از آن استفاده می‌کند).
- `🩹 Error Monitor` را Activate کنید و در Settings سایر Workflowها به‌عنوان *Error Workflow* انتخاب کنید.

### ۵) اتصال بات بله به اپ Agent (مسیر مستقیم بدون n8n)
```bash
curl -X POST https://agent.example.com/api/bale/webhook -H 'Content-Type: application/json' -d '{"action":"set"}'
```

---

## سناریوی کامل

1. در بله به بات پیام می‌دهید: «یک اتوماسیون بساز که هر پیامی به بات بله بفرستم، آن را به Codex بفرستد و پاسخ را برایم برگرداند.»
2. Webhook بله → `POST /api/webhook/bale` → درخواست ثبت و «در حال ساخت…» پاسخ داده می‌شود.
3. مغز Agent: دانش مرتبط بازیابی → Prompt ساخته → Codex JSON تولید می‌کند.
4. اعتبارسنج: Schema، Trigger یکتا، اتصالات، مدل زبانی متصل به AI Agent، تولید `id`/`webhookId`.
5. `POST /api/v1/workflows` → id → `POST /activate`.
6. Workflow جدید (Bale Trigger → AI Agent + Codex → Send Bale Message) فعال است و بات کار می‌کند.
7. نتیجه + لینک به کاربر در بله برگردانده می‌شود؛ الگوی موفق در پایگاه دانش ذخیره می‌شود.
8. اگر بعداً اجرایی خطا داد: Error Workflow → `POST /api/agent/monitor` → Agent با خطا Prompt جدید می‌سازد → `PUT /workflows/:id` → activate → درس آموخته‌شده ذخیره می‌شود.

---

## API اپ Agent

| متد | مسیر | توضیح |
|---|---|---|
| POST | `/api/agent/build` | `{ prompt, wait? }` — ورودی فرم وب |
| POST | `/api/webhook/bale` | Update بله (Telegram-like) |
| POST | `/api/webhook/soroush` | Update سروش |
| POST | `/api/webhook/n8n` | `{ prompt, chatId?, wait? }` — نود ورودی n8n (هدر `X-Agent-Secret`) |
| GET | `/api/agent/requests` · `/api/agent/requests/:id` | فهرست / جزئیات (لاگ لایه‌ها، نسخه‌ها، اجراها) |
| POST | `/api/agent/requests/:id/heal` | Self-Heal دستی `{ error? }` |
| POST | `/api/agent/requests/:id/monitor` | بررسی اجراهای n8n برای یک درخواست |
| GET/POST | `/api/agent/monitor` | مانیتور سراسری / گزارش خطا از Error Workflow `{ workflowId, error }` |
| GET | `/api/agent/status` | وضعیت Codex / n8n / بله / پایگاه دانش |
| POST | `/api/bale/webhook` | `{ action: set\|delete\|info }` |

---

## توسعه و تست نودهای سفارشی با `n8n-node-dev`

```bash
cd n8n/custom-nodes
npm install
npm run build          # tsc + کپی آیکون‌ها → dist/
npm test               # تست‌های واحد اعتبارسنج
# روش ۱: n8n-node-dev (بیلد مستقیم به ~/.n8n/custom)
npx n8n-node-dev build --destination ~/.n8n/custom
# روش ۲: لینک به‌عنوان community package
npm pack && cd ~/.n8n/nodes && npm i /path/to/n8n-nodes-bale-1.0.0.tgz
n8n start
```

### حالت‌های Codex در اپ (`CODEX_MODE`)
| مقدار | رفتار |
|---|---|
| `auto` | اولین گزینهٔ در دسترس: `codex-cli` → `codex-n8n` → `openai-compatible` → `heuristic` |
| `codex-cli` | `codex exec --skip-git-repo-check --ephemeral --sandbox read-only -o …` (اشتراک شما) |
| `codex-n8n` | POST به Workflow «Codex LLM Proxy» در n8n |
| `openai-compatible` | `OPENAI_API_KEY` + `OPENAI_BASE_URL` |
| `heuristic` | موتور قالب‌محور داخلی — بدون شبکه؛ همیشه Workflow معتبر می‌دهد |

---

## امنیت
- `BALE_WEBHOOK_SECRET`: بله فقط با `?secret=` معتبر پذیرفته می‌شود.
- `AGENT_SHARED_SECRET`: هدر `X-Agent-Secret` برای `/api/webhook/n8n`.
- Codex در حالت `read-only` و در پوشهٔ موقت ایزوله اجرا می‌شود؛ هیچ دسترسی نوشتنی ندارد.
- کلید API n8n فقط سمت سرور خوانده می‌شود.
