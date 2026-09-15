"use client";

/**
 * فهرست درخواست‌ها با به‌روزرسانی خودکار
 */
import Link from "next/link";
import { useEffect, useState } from "react";

interface Req {
  id: number;
  source: string;
  prompt: string;
  status: string;
  resultSummary: string | null;
  n8nWorkflowUrl: string | null;
  simulated: boolean;
  healAttempts: number;
  createdAt: string;
}

export const STATUS_FA: Record<string, { label: string; cls: string }> = {
  received: { label: "دریافت شد", cls: "text-slate-300 border-slate-600" },
  planning: { label: "در حال برنامه‌ریزی", cls: "text-indigo-300 border-indigo-700 pulse" },
  generating: { label: "تولید با Codex", cls: "text-indigo-300 border-indigo-700 pulse" },
  validating: { label: "اعتبارسنجی", cls: "text-sky-300 border-sky-700 pulse" },
  creating: { label: "ساخت در n8n", cls: "text-sky-300 border-sky-700 pulse" },
  activating: { label: "فعال‌سازی", cls: "text-teal-300 border-teal-700 pulse" },
  monitoring: { label: "مانیتور", cls: "text-teal-300 border-teal-700 pulse" },
  healing: { label: "ترمیم خودکار", cls: "text-amber-300 border-amber-700 pulse" },
  done: { label: "انجام شد", cls: "text-emerald-300 border-emerald-700" },
  failed: { label: "ناموفق", cls: "text-rose-300 border-rose-700" },
};

const SOURCE_FA: Record<string, string> = { web: "وب", bale: "بله", soroush: "سروش", n8n: "n8n" };

export default function RequestList() {
  const [rows, setRows] = useState<Req[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/agent/requests")
        .then((r) => r.json())
        .then((d) => alive && setRows(d.requests ?? []))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">درخواست‌های اخیر</h2>
        <span className="text-xs text-slate-500">{rows.length} مورد</span>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 text-center text-sm text-slate-500">هنوز درخواستی ثبت نشده است.</div>
      ) : (
        <ul className="mt-4 divide-y divide-[#1f2a4d]">
          {rows.map((r) => {
            const st = STATUS_FA[r.status] ?? { label: r.status, cls: "" };
            return (
              <li key={r.id} className="py-3">
                <Link href={`/requests/${r.id}`} className="block rounded-lg px-2 py-1 hover:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="mono text-xs text-slate-500">#{r.id}</span>
                      <span className="badge text-slate-400">{SOURCE_FA[r.source] ?? r.source}</span>
                      {r.simulated && <span className="badge text-amber-300">شبیه‌سازی</span>}
                      {r.healAttempts > 0 && <span className="badge text-amber-300">🩹 {r.healAttempts}</span>}
                    </div>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm">{r.prompt}</div>
                  {r.resultSummary && <div className="mt-1 line-clamp-1 text-xs text-slate-400">{r.resultSummary}</div>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
