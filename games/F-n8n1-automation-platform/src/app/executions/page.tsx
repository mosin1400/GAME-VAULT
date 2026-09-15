"use client";
// تاریخچه اجراها – فیلتر، جستجو در داده‌ها، مشاهده جزئیات هر نود
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, StatusBadge, Modal, fmtDate, fmtMs } from "@/components/ui";
import type { Execution } from "@/db/schema";

type Row = Pick<Execution, "id" | "workflowId" | "workflowName" | "status" | "mode" | "error" | "startedAt" | "finishedAt" | "durationMs">;

function ExecutionsInner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Execution | null>(null);
  const sp = useSearchParams();
  const load = useCallback(() => { const u = new URLSearchParams(); if (status) u.set("status", status); if (q) u.set("q", q); fetch(`/api/executions?${u}`).then((r) => r.json()).then(setRows); }, [status, q]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  const open = useCallback((id: number) => fetch(`/api/executions/${id}`).then((r) => r.json()).then(setDetail), []);
  useEffect(() => { const id = sp.get("id"); if (id) open(Number(id)); }, [sp, open]);
  const clearAll = async () => { if (!confirm("حذف کل تاریخچه؟")) return; await fetch("/api/executions", { method: "DELETE" }); load(); };
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="تاریخچه اجرا" subtitle="نگهداری ۳۶۵ روزه • جستجو در داده‌های درون اجرا" actions={<button onClick={clearAll} className="ff-btn-danger">پاک‌سازی</button>} />
      <div className="flex gap-2 mb-4">
        <select className="ff-input max-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">همه وضعیت‌ها</option><option value="success">موفق</option><option value="error">خطا</option><option value="running">در حال اجرا</option></select>
        <input className="ff-input" placeholder="جستجو در داده‌های اجرا (مثلاً chatId یا متن خطا)…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="ff-card overflow-hidden">
        <table className="ff-table">
          <thead><tr><th>#</th><th>جریان</th><th>حالت</th><th>وضعیت</th><th>شروع</th><th>مدت</th><th>خطا</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.id} className="hover:bg-[#151d3b] cursor-pointer" onClick={() => open(r.id)}>
              <td className="ff-mono">{r.id}</td><td><Link href={`/workflows/${r.workflowId}`} onClick={(e) => e.stopPropagation()} className="hover:text-orange-300">{r.workflowName}</Link></td><td className="text-slate-400">{r.mode}</td><td><StatusBadge status={r.status} /></td><td className="text-xs text-slate-400">{fmtDate(r.startedAt)}</td><td className="ff-mono text-xs">{fmtMs(r.durationMs)}</td><td className="text-xs text-red-300 max-w-xs truncate">{r.error}</td><td className="text-xs text-orange-300">جزئیات</td>
            </tr>)}
            {!rows.length && <tr><td colSpan={8} className="text-center text-slate-500 py-10">اجرایی یافت نشد</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`اجرای #${detail?.id} – ${detail?.workflowName}`} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm items-center"><StatusBadge status={detail.status} /><span>حالت: {detail.mode}</span><span>مدت: {fmtMs(detail.durationMs)}</span><span className="text-slate-400">{fmtDate(detail.startedAt)}</span><Link href={`/workflows/${detail.workflowId}`} className="text-orange-300">باز کردن جریان →</Link></div>
            {detail.error && <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">{detail.error}</div>}
            <div>
              <div className="font-semibold mb-2">نودها</div>
              <div className="space-y-2">
                {Object.entries(detail.result?.nodes ?? {}).map(([nid, r]) => (
                  <details key={nid} className="ff-card p-2">
                    <summary className="cursor-pointer text-sm flex items-center gap-2"><StatusBadge status={r.status} /><span className="ff-mono text-xs text-slate-400">{nid}</span><span className="text-xs text-slate-400">{r.output.length} آیتم • {r.durationMs}ms</span>{r.error && <span className="text-xs text-red-300">{r.error}</span>}</summary>
                    <pre dir="ltr" className="ff-mono text-[11px] bg-[#0b1020] rounded p-2 mt-2 overflow-auto max-h-64">{JSON.stringify(r.output, null, 2)}</pre>
                  </details>
                ))}
              </div>
            </div>
            <div><div className="font-semibold mb-2">لاگ</div><div dir="ltr" className="ff-mono text-[11px] bg-[#0b1020] rounded p-2 max-h-64 overflow-auto space-y-0.5">{detail.result?.logs.map((l, i) => <div key={i} className={l.level === "error" ? "text-red-300" : l.level === "warn" ? "text-amber-300" : "text-slate-300"}>{l.ts.slice(11, 23)} [{l.level}] {l.message}</div>)}</div></div>
            <div><div className="font-semibold mb-2">داده تریگر</div><pre dir="ltr" className="ff-mono text-[11px] bg-[#0b1020] rounded p-2 max-h-40 overflow-auto">{JSON.stringify(detail.triggerData, null, 2)}</pre></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
export default function ExecutionsPage() { return <Suspense fallback={<div className="p-6">…</div>}><ExecutionsInner /></Suspense>; }
