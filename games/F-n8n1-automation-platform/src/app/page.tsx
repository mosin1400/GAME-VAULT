"use client";
// داشبورد – متریک‌های کلی، نمودار اجراها، اجراهای اخیر
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Stat, StatusBadge, fmtDate, fmtMs } from "@/components/ui";

type Stats = {
  workflows: { total: number; active: number };
  executions: { total: number; success: number; error: number; avgMs: number; last24h: number };
  credentials: number; nodes: number; integrations: number; templates: number; running: number;
  daily: { day: string; total: number; errors: number }[];
  recent: { id: number; workflowName: string; status: string; mode: string; startedAt: string; durationMs: number }[];
  topWorkflows: { workflowId: number; workflowName: string; total: number; errors: number }[];
  uptimeSec: number; memoryMb: number;
};

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    const load = () => fetch("/api/stats").then((r) => r.json()).then(setS).catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);
  const max = Math.max(1, ...(s?.daily.map((d) => d.total) ?? [1]));
  const successRate = s && s.executions.total ? Math.round((s.executions.success / s.executions.total) * 100) : 100;
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="داشبورد" subtitle="نمای کلی سلامت پلتفرم، اجراها و منابع" actions={<><Link href="/workflows?new=1" className="ff-btn-primary">＋ جریان جدید</Link><Link href="/templates" className="ff-btn-ghost">📚 قالب‌ها</Link></>} />
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <Stat label="جریان‌های کاری" value={s?.workflows.total ?? "…"} hint={`${s?.workflows.active ?? 0} فعال`} icon="🧩" />
        <Stat label="اجراها (کل)" value={s?.executions.total ?? "…"} hint={`${s?.executions.last24h ?? 0} در ۲۴ ساعت اخیر`} icon="📜" />
        <Stat label="نرخ موفقیت" value={`${successRate}%`} hint={`${s?.executions.error ?? 0} خطا`} icon="✅" />
        <Stat label="میانگین زمان اجرا" value={fmtMs(s?.executions.avgMs)} hint={`${s?.running ?? 0} در حال اجرا`} icon="⏱️" />
        <Stat label="نودهای داخلی" value={s?.nodes ?? "…"} hint={`${s?.integrations ?? 0} یکپارچه‌سازی`} icon="🔌" />
        <Stat label="قالب‌های آماده" value={s?.templates ?? "…"} hint={`${s?.credentials ?? 0} اعتبارنامه`} icon="📚" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <div className="ff-card p-4 lg:col-span-2">
          <div className="font-semibold mb-3">اجراها در ۱۴ روز اخیر</div>
          <div className="flex items-end gap-1 h-40" dir="ltr">
            {(s?.daily.length ? s.daily : [{ day: "—", total: 0, errors: 0 }]).map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full relative bg-[#1a2347] rounded-t" style={{ height: `${(d.total / max) * 130 + 4}px` }}>
                  <div className="absolute bottom-0 w-full bg-red-500/70 rounded-t" style={{ height: `${d.total ? (d.errors / d.total) * 100 : 0}%` }} />
                  <div className="absolute -top-5 w-full text-center text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">{d.total}</div>
                </div>
                <div className="text-[9px] text-slate-500">{d.day}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="ff-card p-4">
          <div className="font-semibold mb-3">سلامت سیستم</div>
          <ul className="text-sm space-y-2 text-slate-300">
            <li className="flex justify-between"><span>PostgreSQL</span><StatusBadge status="online" /></li>
            <li className="flex justify-between"><span>Scheduler (Cron)</span><StatusBadge status="online" /></li>
            <li className="flex justify-between"><span>Uptime</span><span className="ff-mono">{s ? `${Math.floor(s.uptimeSec / 60)}m ${s.uptimeSec % 60}s` : "…"}</span></li>
            <li className="flex justify-between"><span>حافظه</span><span className="ff-mono">{s?.memoryMb ?? "…"} MB</span></li>
            <li className="flex justify-between"><span>Encryption at Rest</span><span className="text-emerald-300">AES-256-GCM</span></li>
          </ul>
          <Link href="/settings" className="ff-btn-ghost w-full justify-center mt-4">Worker View →</Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="ff-card p-4 lg:col-span-2">
          <div className="flex justify-between items-center mb-3"><div className="font-semibold">اجراهای اخیر</div><Link href="/executions" className="text-xs text-orange-300">همه →</Link></div>
          <table className="ff-table">
            <thead><tr><th>#</th><th>جریان</th><th>حالت</th><th>وضعیت</th><th>زمان</th><th>مدت</th></tr></thead>
            <tbody>
              {s?.recent.map((r) => (
                <tr key={r.id}><td className="ff-mono">{r.id}</td><td>{r.workflowName}</td><td className="text-slate-400">{r.mode}</td><td><StatusBadge status={r.status} /></td><td className="text-slate-400 text-xs">{fmtDate(r.startedAt)}</td><td className="ff-mono text-xs">{fmtMs(r.durationMs)}</td></tr>
              ))}
              {!s?.recent.length && <tr><td colSpan={6} className="text-center text-slate-500 py-6">هنوز اجرایی ثبت نشده. یک قالب را امتحان کنید.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="ff-card p-4">
          <div className="font-semibold mb-3">پرکاربردترین جریان‌ها</div>
          <ul className="space-y-2 text-sm">
            {s?.topWorkflows.map((w) => (
              <li key={w.workflowId} className="flex justify-between items-center"><Link href={`/workflows/${w.workflowId}`} className="hover:text-orange-300 truncate">{w.workflowName}</Link><span className="text-xs text-slate-400 ff-mono">{w.total} / <span className="text-red-300">{w.errors}</span></span></li>
            ))}
            {!s?.topWorkflows.length && <li className="text-slate-500 text-sm">—</li>}
          </ul>
          <div className="mt-4 pt-4 border-t border-[#1f2a4d] text-xs text-slate-400 space-y-1">
            <div>🤖 AI Agent / RAG / Guardrails</div>
            <div>🟢 بله • 🔵 سروش • ✈️ تلگرام</div>
            <div>📡 MQTT • Modbus • TCP/UDP • WebSocket</div>
            <div>🐳 Docker Compose • Queue Mode • Multi-Main</div>
          </div>
        </div>
      </div>
    </div>
  );
}
