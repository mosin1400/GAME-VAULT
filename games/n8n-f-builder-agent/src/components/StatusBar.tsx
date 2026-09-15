"use client";

/**
 * نوار وضعیت سیستم: ارائه‌دهندهٔ فعال Codex، اتصال n8n، بله، و آمار پایگاه دانش
 */
import { useEffect, useState } from "react";

interface Status {
  providers: { mode: string; active: string; codexCli: boolean; codexN8n: boolean; openaiCompatible: boolean; model: string };
  n8n: { ok: boolean; message: string; mcp: boolean };
  bale: { configured: boolean };
  knowledge: { successPatterns: number; lessons: number };
  stats: { total: number; done: number; failed: number; inProgress: number };
}

const PROVIDER_LABEL: Record<string, string> = {
  "codex-cli": "Codex CLI (اشتراک شما)",
  "codex-n8n": "Codex از طریق n8n",
  "openai-compatible": "API سازگار با OpenAI",
  heuristic: "موتور قالب‌محور داخلی",
};

function Dot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  const color = ok ? "bg-emerald-400" : warn ? "bg-amber-400" : "bg-rose-400";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

export default function StatusBar() {
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/agent/status")
        .then((r) => r.json())
        .then((d) => alive && setStatus(d))
        .catch((e) => alive && setErr(String(e)));
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (err) return <div className="panel p-4 text-sm text-rose-300">خطا در دریافت وضعیت: {err}</div>;
  if (!status) return <div className="panel p-4 text-sm text-slate-400">در حال دریافت وضعیت سیستم...</div>;

  const heuristic = status.providers.active === "heuristic";

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <div className="panel p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
          <Dot ok={!heuristic} warn={heuristic} /> مغز Agent (لایهٔ ۲)
        </div>
        <div className="text-sm font-semibold">{PROVIDER_LABEL[status.providers.active] ?? status.providers.active}</div>
        <div className="mt-1 text-[11px] text-slate-400">
          مدل: <span className="mono">{status.providers.model}</span> · حالت: {status.providers.mode}
        </div>
        {heuristic && (
          <div className="mt-2 text-[11px] text-amber-300">
            برای اتصال به Codex: روی سرور <span className="mono">codex login</span> بزنید یا N8N_CODEX_WEBHOOK_URL / OPENAI_API_KEY را تنظیم کنید.
          </div>
        )}
      </div>

      <div className="panel p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
          <Dot ok={status.n8n.ok} warn={!status.n8n.ok} /> n8n (لایهٔ ۳ و ۴)
        </div>
        <div className="text-sm font-semibold">{status.n8n.ok ? "متصل — ساخت واقعی" : "حالت شبیه‌سازی"}</div>
        <div className="mt-1 break-all text-[11px] text-slate-400">{status.n8n.message}</div>
        <div className="mt-1 text-[11px] text-slate-400">MCP Server: {status.n8n.mcp ? "فعال" : "غیرفعال"}</div>
      </div>

      <div className="panel p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
          <Dot ok={status.bale.configured} warn={!status.bale.configured} /> بات بله (لایهٔ ۱)
        </div>
        <div className="text-sm font-semibold">{status.bale.configured ? "توکن تنظیم شده" : "BALE_BOT_TOKEN تنظیم نشده"}</div>
        <div className="mt-1 text-[11px] text-slate-400">
          Webhook: <span className="mono">/api/webhook/bale</span>
        </div>
      </div>

      <div className="panel p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
          <Dot ok /> حافظهٔ خودتکامل‌شونده
        </div>
        <div className="flex gap-4 text-sm">
          <div>
            <div className="text-lg font-bold text-emerald-300">{status.knowledge.successPatterns}</div>
            <div className="text-[11px] text-slate-400">الگوی موفق</div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-300">{status.knowledge.lessons}</div>
            <div className="text-[11px] text-slate-400">درس از خطا</div>
          </div>
          <div>
            <div className="text-lg font-bold text-indigo-300">{status.stats.done}/{status.stats.total}</div>
            <div className="text-[11px] text-slate-400">موفق / کل</div>
          </div>
        </div>
      </div>
    </div>
  );
}
