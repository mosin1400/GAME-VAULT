"use client";
// متغیرهای سراسری – در عبارت‌ها با {{ $vars.KEY }} در دسترس‌اند
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
type V = { id: number; key: string; value: string; description: string };
export default function VariablesPage() {
  const [list, setList] = useState<V[]>([]);
  const [form, setForm] = useState({ key: "", value: "", description: "" });
  const load = () => fetch("/api/variables").then((r) => r.json()).then(setList);
  useEffect(() => { load(); }, []);
  const save = async () => { if (!form.key) return; await fetch("/api/variables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); setForm({ key: "", value: "", description: "" }); load(); };
  const remove = async (id: number) => { await fetch(`/api/variables/${id}`, { method: "DELETE" }); load(); };
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="متغیرهای سراسری" subtitle="در همه جریان‌ها با {{ $vars.KEY }} قابل استفاده" />
      <div className="ff-card p-4 grid md:grid-cols-4 gap-2 mb-4">
        <input dir="ltr" className="ff-input ff-mono" placeholder="KEY" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
        <input dir="ltr" className="ff-input ff-mono" placeholder="value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        <input className="ff-input" placeholder="توضیح" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="ff-btn-primary justify-center" onClick={save}>ذخیره / به‌روزرسانی</button>
      </div>
      <div className="ff-card overflow-hidden"><table className="ff-table"><thead><tr><th>کلید</th><th>مقدار</th><th>توضیح</th><th></th></tr></thead>
        <tbody>{list.map((v) => <tr key={v.id}><td className="ff-mono" dir="ltr">{v.key}</td><td className="ff-mono text-slate-300" dir="ltr">{v.value}</td><td className="text-slate-400 text-xs">{v.description}</td><td><button className="text-red-300 text-xs" onClick={() => remove(v.id)}>حذف</button></td></tr>)}
        {!list.length && <tr><td colSpan={4} className="text-center text-slate-500 py-8">متغیری تعریف نشده (مثال: BALE_CHAT_ID, ALERT_CHAT_ID)</td></tr>}</tbody></table></div>
    </div>
  );
}
