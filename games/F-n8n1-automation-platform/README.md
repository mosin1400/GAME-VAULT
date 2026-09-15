# FlowForge Automation Platform

FlowForge is a self-hosted workflow automation platform inspired by n8n. It combines a visual workflow builder with a reliable execution engine, version control, auditability, and extensible integrations.

## Highlights

- Drag-and-drop workflow design with branching, loops, joins, and reusable templates
- Extensible node and integration registry with custom-node support
- AI-assisted authoring with validation and safe execution boundaries
- Queue-based execution, retries, execution history, and audit logs
- REST APIs and a clean project structure for maintainable deployments

## Project overview

FlowForge is designed around a typed workflow model, validation layer, execution engine, and provider registry. Workflows are validated before execution, while execution records and audit events provide traceability for operators.

<!-- Original product notes -->
FlowForge یک **اکوسیستم کامل اتوماسیون کاری** مانند n8n است که به‌صورت لوکال با Docker Compose اجرا می‌شود:
ویرایشگر بصری Drag & Drop، موتور اجرای واقعی با شاخه/حلقه/ادغام، **۵۰۰+ نود داخلی** و **۲۵۰+ یکپارچه‌سازی**، **۹۰۰+ قالب آماده**، AI Agent/RAG/Guardrails، پیام‌رسان‌های **بله و سروش**، IoT (MQTT/Modbus/TCP/UDP/WebSocket)، Queue Mode، Multi-Main، Version Control، Audit Log و REST API/CLI کامل.

---

## 🚀 اجرای سریع

### اجرای محلی روی Windows بدون Docker

پیش‌نیازها: Node.js 20+ و PostgreSQL. سپس در PowerShell:

```powershell
Copy-Item .env.example .env
# DATABASE_URL و ENCRYPTION_KEY را در .env تنظیم کنید
./scripts/check-local.ps1
npm.cmd install
npm.cmd run build
npm.cmd run start
```

برنامه روی `http://localhost:3000` اجرا می‌شود. Redis، MinIO و MQTT برای اجرای محلی ضروری نیستند و فقط هنگام استفاده از Queue، ذخیره‌سازی S3 یا IoT لازم می‌شوند.

برای backup و restore:

```powershell
./scripts/backup-local.ps1
./scripts/restore-local.ps1 -BackupFile .\backups\flowforge-YYYYMMDD-HHMMSS.sql
```

```bash
git clone <repo> flowforge && cd flowforge
./setup.sh              # حالت عادی  → http://localhost:3000
./setup.sh queue        # Queue Mode با ۳ Worker
./setup.sh ha           # Multi-Main + Nginx (http://localhost:8080)
./setup.sh dev          # بدون Docker (Node 20 + PostgreSQL لوکال)
```

سرویس‌های Compose: `postgres` (16)، `redis` (7)، `minio` (S3)، `mosquitto` (MQTT)، `app` (UI+API+Scheduler)، `worker` (پروفایل queue)، `app-2` + `proxy` (پروفایل ha).
Kubernetes: `kubectl apply -f deploy/k8s/flowforge.yaml` — Swarm: `docker stack deploy -c docker-compose.yml flowforge`.

---

## 🧱 معماری

```
src/
├─ app/                     # Next.js App Router (UI + REST API)
│  ├─ page.tsx              # داشبورد
│  ├─ workflows/[id]        # ویرایشگر بصری (React Flow)
│  ├─ executions|templates|nodes|credentials|variables|audit|settings
│  └─ api/                  # REST API (workflows, executions, webhook, ai/build, ...)
├─ lib/
│  ├─ nodes/catalog.ts      # کاتالوگ ۵۰۰+ نود (داده خالص، ماژولار)
│  ├─ engine/executor.ts    # موتور اجرا (topological + branches + loops + sub-workflows)
│  ├─ engine/handlers.ts    # پیاده‌سازی هر نود (HTTP, Code, Bash, AI, Bale, MQTT, Modbus, ...)
│  ├─ engine/expressions.ts # موتور عبارت‌ها {{ $json }} {{ $node["X"] }} {{ $vars }} {{ $jalali() }}
│  ├─ engine/llm.ts         # OpenAI/Anthropic/Gemini/Ollama/Codex + Memory + Vector Store
│  ├─ engine/scheduler.ts   # Cron / Polling
│  └─ templates.ts          # ۹۰۰+ قالب
├─ db/schema.ts             # Drizzle ORM (workflows, versions, executions, credentials, variables, audit, users)
custom-nodes/               # پکیج نودهای سفارشی (TypeScript + dist JS کامپایل‌شده، سازگار با n8n)
scripts/                    # ffctl.sh (CLI), worker.mjs (Queue Worker), git-sync.sh
deploy/k8s/                 # مانیفست‌های Kubernetes
docker-compose.yml • Dockerfile • setup.sh • .env.example
```

---

## ✨ قابلیت‌ها

### ویرایشگر و هسته
- Drag & Drop، MiniMap، Snap-to-grid، اجرای کامل یا «اجرا تا این نود»، نمایش خروجی هر نود و لاگ实时
- If / Switch / Filter / Merge / Loop (Split in Batches با back-edge) / Wait / Stop & Error
- Sub-workflow (`Execute Sub-Workflow`)، Error Workflow، Human-in-the-Loop، Guardrails
- Version Control داخلی (هر ذخیره → نسخه جدید، بازگردانی) + `scripts/git-sync.sh` برای Git
- Import/Export JSON (سازگاری پایه با فرمت n8n)، Environments (dev/staging/prod)، Projects، Tags

### کدنویسی
- **Code (JavaScript)**: `$input`, `$json`, `$vars`, `$node`, `fetch`, `require` (پکیج‌های مجاز از `NODE_FUNCTION_ALLOW_EXTERNAL`)
- **Code (Python)**، **Bash Script Executor**، **Expression Evaluator**، **Import cURL** در HTTP Request

### هوش مصنوعی (AI-Native)
- **AI Agent** با حافظه و ابزارها (http / js / sub-workflow / agent-as-tool)، حلقه ReAct
- **LLM Chat**: OpenAI، Anthropic، Google Gemini، **Codex (device-code auth)**، Ollama، OpenRouter، هر endpoint سازگار با OpenAI
- **RAG**: Document Loader → Text Splitter → Embeddings → Vector Store (لوکال/pgvector/Pinecone/Weaviate/Milvus/Qdrant/Chroma) → RAG Q&A Chain
- **Codex Automation Agent** (`/api/ai/build`): جستجوی ابزارهای واقعی، خواندن schema، سؤال تکمیلی، اعتبارسنجی و اصلاح جریان؛ پیش‌نمایش قبل از ذخیره‌ی غیرفعال. راهنما: [docs/codex-automation-agent.md](docs/codex-automation-agent.md).
- Guardrails (کلمات ممنوعه، PII، طول)، Sentiment، Text Classifier

### یکپارچه‌سازی‌ها (نمونه)
پیام‌رسان: Slack، Teams، Discord، Telegram، **Bale**، **Soroush**، WhatsApp، Twilio، Mattermost، Kavenegar، SMS.ir …
Email: SMTP، IMAP، Gmail، Outlook، SendGrid، Mailgun … • پروژه: Jira، Trello، Asana، Monday، ClickUp، Linear، Notion، Todoist …
Google Workspace کامل • Microsoft 365 کامل • CRM: HubSpot، Salesforce، Pipedrive، Zoho … • مارکتینگ: Mailchimp، Brevo، ConvertKit …
دیتابیس: PostgreSQL، MySQL، MongoDB، MSSQL، SQLite، Supabase، Redis، Elasticsearch … • Vector DB • Storage: Drive، OneDrive، Dropbox، Nextcloud، S3/MinIO، FTP/SFTP
DevOps: GitHub، GitLab، Bitbucket، Docker، Kubernetes، PagerDuty، ServiceNow، Datadog … • تجارت: Shopify، WooCommerce، Stripe، PayPal، Zarinpal …
IoT: MQTT، TCP/UDP، WebSocket، Modbus، OPC UA، Home Assistant …

> نودهای «genericApi» با Credential (Bearer/API Key/Basic) درخواست واقعی REST می‌فرستند؛ با گزینه *simulate* بدون تماس واقعی برای تست جریان کار می‌کنند.

### تریگرها
Manual • Webhook (`/api/webhook/<path>` با توکن اختیاری و Respond to Webhook) • Schedule (Cron) • Polling • File Watcher • Email (IMAP) • Database CDC • MQTT • WebSocket Server • Error • Chat • تریگر هر یکپارچه‌سازی

### سازمانی
- Credentials با **AES-256-GCM** (Encryption at Rest)، ماسک در UI
- RBAC (owner/admin/editor/member/viewer)، 2FA، SSO (SAML/OIDC) و LDAP از طریق env و Reverse Proxy
- Audit Log کامل، Log Streaming (Datadog/ELK/Loki/Webhook)، Execution History با جستجو در داده‌ها
- Queue Mode (Redis + Workerها)، Multi-Main (HA)، Worker View، Binary Data روی S3/MinIO
- REST API کامل + CLI (`scripts/ffctl.sh`)

---

## 🔌 نودهای سفارشی ویژه (`custom-nodes/`)

| نود | فایل | توضیح |
|---|---|---|
| Bale Messenger | `Bale.node.ts` | متن/تصویر/فایل/Webhook (`tapi.bale.ai`) |
| Soroush Plus | `Soroush.node.ts` | متن/فایل/دریافت (`bot.splus.ir`) |
| Local TCP/UDP | `LocalSocket.node.ts` | سوکت خام با encoding |
| Codex Agent | `CodexAgent.node.ts` | Chat Model با اشتراک موجود + refresh token |
| File System Watcher | `FileWatcher.node.ts` | add/change/unlink با debounce و pattern |
| Bash Executor | `BashExecutor.node.ts` | stdout/stderr/exitCode/timeout/stdin |
| WebSocket Client/Server | `WebSocketNode.node.ts` | کلاینت + سرور RFC6455 |
| MQTT Client | `MqttClient.node.ts` | Publish + Subscribe (تریگر) |
| Modbus TCP | `Modbus.node.ts` | FC1–6، 15، 16 + Int16/Float32/UInt32 |
| Database Trigger (CDC) | `DatabaseTrigger.node.ts` | LISTEN/NOTIFY خودکار یا Polling |

```bash
cd custom-nodes && npm install && npm run build   # خروجی در dist/
# استفاده در n8n:  N8N_CUSTOM_EXTENSIONS=/path/to/custom-nodes
```
**افزودن نود جدید:** در `src/lib/nodes/catalog.ts` تعریف نود را اضافه کنید و هندلر آن را در `src/lib/engine/handlers.ts` بنویسید (یا برای پکیج مستقل، فایل `custom-nodes/src/nodes/X.node.ts` را ساخته و در `index.ts` export کنید).

---

## 🧪 نمونه‌ها

```bash
# CLI
./scripts/ffctl.sh list
./scripts/ffctl.sh build "هر روز ساعت ۹ داده‌ها را از API بگیر و در بله پیام بده"
./scripts/ffctl.sh run 1 '{"userId": 1}'
./scripts/ffctl.sh export 1 my-flow.json && ./scripts/ffctl.sh import my-flow.json

# Webhook
curl -X POST http://localhost:3000/api/webhook/lead -H 'Content-Type: application/json' -d '{"name":"علی","email":"ali@example.com"}'

# REST
curl -X POST http://localhost:3000/api/workflows/1/execute -H 'Content-Type: application/json' -d '{"mode":"api"}'
```

### Codex با device-code
```bash
npm i -g @openai/codex && codex login --device-code
cat ~/.codex/auth.json   # access_token / refresh_token / account_id
```
مقادیر را در «اعتبارنامه‌ها → Codex (device-code)» یا `CODEX_ACCESS_TOKEN` قرار دهید؛ نود **Codex Agent** بدون API Key پولی کار می‌کند.

---

## ⚙️ متغیرهای محیطی مهم
`DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`, `FILES_DIR`, `EXECUTIONS_MODE=regular|queue`, `MULTI_MAIN`, `ALLOW_SHELL_NODES`, `NODE_FUNCTION_ALLOW_EXTERNAL`, `NODES_EXCLUDE`,
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OLLAMA_URL`, `CODEX_ACCESS_TOKEN`, `TELEGRAM_BOT_TOKEN`, `BALE_BOT_TOKEN`, `SSO_*`, `LDAP_*`, `VAULT_*` — کامل در `.env.example`.

---

## 📜 مجوز
MIT — ساخته‌شده برای اجرا روی زیرساخت خودتان، بدون وابستگی به ابر.

### Linux بدون Docker

راهنمای نصب یک‌باره در `docs/install-once-linux.md` قرار دارد. مسیر سریع:

```bash
chmod +x scripts/*.sh
./scripts/install-local.sh
./scripts/start-local.sh
```
