"use client";

/**
 * صفحهٔ جزئیات درخواست: خط زمانی چهار لایه، لاگ‌ها، JSON Workflow، اقدامات (Self-Heal، مانیتور، دانلود)
 */
import { useCallback, useEffect, useState } from "react";
import { STATUS_FA } from "./RequestList";

interface Detail {
  request: {
    id: number;
    source: string;
    prompt: string;
    status: string;
    resultSummary: string | null;
    n8nWorkflowId: string | null;
    n8nWorkflowUrl: string | null;
    simulated: boolean;
    healAttempts: number;
    chatId: string | null;
    createdAt: string;
  };
  workflows: { id: number; version: number; name: string; workflowJson: unknown; provider: string; active: boolean; validationErrors: string[]; createdAt: string }[];
  logs: { id: number; layer: string; level: string; message: string; data: unknown; createdAt: string }[];
  events: { id: number; n8nExecutionId: string; status: string; errorMessage: string | null; healed: boolean; createdAt: string }[];
}

const LAYERS = [
  { key: "input", title: "۱. ورودی", desc: "وب / بله / سروش / n8n" },
  { key: "core", title: "۲. مغز Agent", desc: "Codex + دستورالعمل + دانش" },
  { key: "builder", title: "۳. سازندهٔ Workflow", desc: "اعتبارسنجی + n8n API" },
  { key: "executor", title: "۴. اجرا و مانیتور", desc: "فعال‌سازی + Self-Heal" },
];

const LEVEL_CLS: Record<string, string> = {
  info: "text-slate-300",
  warn: "text-amber-300",
  error: "text-rose-300",
  success: "text-emerald-300",
};

const ACTIVE_STATUSES = new Set(["received", "planning", "generating", "validating", "creating", "activating", "monitoring", "healing"]);

export default function RequestDetail({ id }: { id: number }) {
  const [data, setData] = useState<Detail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/agent/requests/${id}`);
    if (res.ok) setData(await res.json());
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      // فقط تا زمانی که درخواست در جریان است، سریع poll می‌کنیم
      load();
    }, 2500);
    return () => clearInterval(t);
  }, [load]);

  async function action(path: string, body?: unknown, label?: string) {
    setBusy(path);
    setNotice(null);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const d = await res.json();
      setNotice(d.ok ? `${label ?? "عملیات"} آغاز شد` : `خطا: ${d.error ?? "نامشخص"}`);
      await load();
    } catch (e) {
      setNotice(String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <div className="panel p-6 text-sm text-slate-400">در حال بارگذاری...</div>;

  const { request, workflows, logs, events } = data;
  const st = STATUS_FA[request.status] ?? { label: request.status, cls: "" };
  const current = workflows.find((w) => w.version === version) ?? workflows[0];
  const jsonText = current ? JSON.stringify(current.workflowJson, null, 2) : "";

  const layerState = (key: string) => {
    const ls = logs.filter((l) => l.layer === key);
    if (ls.some((l) => l.level === "error")) return "error";
    if (ls.some((l) => l.level === "success")) return "done";
    if (ls.length) return "active";
    return "idle";
  };

  const download = () => {
    const blob = new Blob([jsonText], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(current?.name ?? "workflow").replace(/[^a-z0-9\u0600-\u06FF]+/gi, "-")}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* هدر */}
      <div className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="mono text-sm text-slate-500">#{request.id}</span>
            <span className="badge text-slate-400">{request.source}</span>
            {request.simulated && <span className="badge text-amber-300">شبیه‌سازی (n8n متصل نیست)</span>}
            <span className={`badge ${st.cls}`}>{st.label}</span>
          </div>
          <div className="text-xs text-slate-500">{new Date(request.createdAt).toLocaleString("fa-IR")}</div>
        </div>
        <p className="mt-4 text-base leading-7">{request.prompt}</p>
        {request.resultSummary && (
          <div className={`mt-3 rounded-lg border p-3 text-sm ${request.status === "failed" ? "border-rose-800 bg-rose-950/40 text-rose-200" : "border-emerald-800 bg-emerald-950/30 text-emerald-200"}`}>
            {request.resultSummary}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {request.n8nWorkflowUrl && (
            <a href={request.n8nWorkflowUrl} target="_blank" className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/30">
              باز کردن در n8n ↗
            </a>
          )}
          {current && (
            <button onClick={download} className="rounded-lg bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
              دانلود JSON (import در n8n)
            </button>
          )}
          <button
            disabled={busy !== null || ACTIVE_STATUSES.has(request.status)}
            onClick={() => action(`/api/agent/requests/${id}/heal`, {}, "Self-Heal / بازسازی")}
            className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/30 disabled:opacity-40"
          >
            🩹 بازسازی / Self-Heal
          </button>
          {request.n8nWorkflowId && (
            <button
              disabled={busy !== null}
              onClick={() => action(`/api/agent/requests/${id}/monitor`, {}, "مانیتور اجراها")}
              className="rounded-lg bg-sky-500/20 px-4 py-2 text-sm text-sky-200 hover:bg-sky-500/30 disabled:opacity-40"
            >
              📡 بررسی اجراها در n8n
            </button>
          )}
        </div>
        {notice && <div className="mt-3 text-xs text-slate-300">{notice}</div>}
      </div>

      {/* خط زمانی لایه‌ها */}
      <div className="grid gap-3 md:grid-cols-4">
        {LAYERS.map((l) => {
          const s = layerState(l.key);
          const cls =
            s === "done" ? "border-emerald-700" : s === "error" ? "border-rose-700" : s === "active" ? "border-indigo-600 pulse" : "border-[#1f2a4d] opacity-60";
          return (
            <div key={l.key} className={`panel border p-4 ${cls}`}>
              <div className="text-sm font-bold">{l.title}</div>
              <div className="text-[11px] text-slate-400">{l.desc}</div>
              <div className="mt-2 text-xs text-slate-300">{logs.filter((x) => x.layer === l.key).length} رویداد</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* لاگ */}
        <div className="panel p-5">
          <h3 className="font-bold">لاگ Agent</h3>
          <ul className="mt-3 max-h-[520px] space-y-2 overflow-auto text-sm">
            {logs.map((l) => (
              <li key={l.id} className="rounded-lg bg-black/20 p-2">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${LEVEL_CLS[l.level] ?? ""}`}>
                    [{l.layer}] {l.message}
                  </span>
                  <span className="mono text-[10px] text-slate-500">{new Date(l.createdAt).toLocaleTimeString("fa-IR")}</span>
                </div>
                {l.data != null && (
                  <pre className="mono mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] text-slate-400">{JSON.stringify(l.data, null, 1)}</pre>
                )}
              </li>
            ))}
          </ul>

          {events.length > 0 && (
            <>
              <h3 className="mt-5 font-bold">اجراهای n8n</h3>
              <ul className="mt-2 space-y-1 text-xs">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded bg-black/20 p-2">
                    <span className="mono">{e.n8nExecutionId}</span>
                    <span className={e.status === "success" ? "text-emerald-300" : "text-rose-300"}>{e.status}</span>
                    {e.errorMessage && <span className="line-clamp-1 max-w-[50%] text-rose-300">{e.errorMessage}</span>}
                    {e.healed && <span className="badge text-amber-300">ترمیم شد</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Workflow JSON */}
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Workflow تولیدشده</h3>
            {workflows.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={current?.version ?? ""}
                  onChange={(e) => setVersion(Number(e.target.value))}
                  className="rounded-md border border-[#1f2a4d] bg-[#0b1020] px-2 py-1 text-xs"
                >
                  {workflows.map((w) => (
                    <option key={w.id} value={w.version}>
                      نسخهٔ {w.version} — {w.provider}
                      {w.active ? " (فعال)" : ""}
                    </option>
                  ))}
                </select>
                <button onClick={() => navigator.clipboard.writeText(jsonText)} className="rounded-md bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                  کپی
                </button>
              </div>
            )}
          </div>
          {current ? (
            <>
              <div className="mt-2 text-xs text-slate-400">
                نام: <b className="text-slate-200">{current.name}</b> · نودها:{" "}
                {(current.workflowJson as { nodes?: { name: string }[] }).nodes?.map((n) => n.name).join(" → ")}
              </div>
              {current.validationErrors?.length > 0 && (
                <div className="mt-2 text-[11px] text-amber-300">هشدارها: {current.validationErrors.join(" | ")}</div>
              )}
              <pre className="mono mt-3 max-h-[560px] overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-5 text-slate-200">{jsonText}</pre>
            </>
          ) : (
            <div className="mt-6 text-center text-sm text-slate-500">
              {ACTIVE_STATUSES.has(request.status) ? "Agent در حال تولید Workflow است..." : "Workflow تولید نشد."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
