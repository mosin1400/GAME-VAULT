"use client";
// Audit Log – ثبت تمام اقدامات برای انطباق
import { useEffect, useState } from "react";
import { PageHeader, fmtDate } from "@/components/ui";
type A = { id: number; actor: string; action: string; resource: string; resourceId: string | null; details: Record<string, unknown>; createdAt: string };
export default function AuditPage() {
  const [list, setList] = useState<A[]>([]);
  useEffect(() => { fetch("/api/audit").then((r) => r.json()).then(setList); }, []);
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Audit Log" subtitle="۲۰۰ رخداد اخیر • قابل استریم به Datadog/ELK از طریق نود Log Stream" />
      <div className="ff-card overflow-hidden"><table className="ff-table"><thead><tr><th>#</th><th>کاربر</th><th>اقدام</th><th>منبع</th><th>شناسه</th><th>جزئیات</th><th>زمان</th></tr></thead>
        <tbody>{list.map((a) => <tr key={a.id}><td className="ff-mono">{a.id}</td><td>{a.actor}</td><td><span className="ff-badge bg-[#1a2347] text-slate-300">{a.action}</span></td><td>{a.resource}</td><td className="ff-mono">{a.resourceId}</td><td className="ff-mono text-[11px] text-slate-400" dir="ltr">{JSON.stringify(a.details)}</td><td className="text-xs text-slate-400">{fmtDate(a.createdAt)}</td></tr>)}
        {!list.length && <tr><td colSpan={7} className="text-center text-slate-500 py-8">رخدادی ثبت نشده</td></tr>}</tbody></table></div>
    </div>
  );
}
