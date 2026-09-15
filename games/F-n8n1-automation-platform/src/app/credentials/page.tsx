"use client";
// اعتبارنامه‌ها – رمزنگاری AES-256-GCM در حالت ذخیره
import { useEffect, useState } from "react";
import { PageHeader, Modal, fmtDate } from "@/components/ui";
import { CREDENTIAL_TYPES } from "@/lib/nodes/catalog";
type C = { id: number; name: string; type: string; createdAt: string; data: Record<string, unknown> };
export default function CredentialsPage() {
  const [list, setList] = useState<C[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ id?: number; name: string; type: string; data: Record<string, string> }>({ name: "", type: "telegram", data: {} });
  const load = () => fetch("/api/credentials").then((r) => r.json()).then(setList);
  useEffect(() => { load(); }, []);
  const def = CREDENTIAL_TYPES.find((t) => t.type === form.type) ?? CREDENTIAL_TYPES[0];
  const save = async () => { await fetch(form.id ? `/api/credentials/${form.id}` : "/api/credentials", { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); setOpen(false); setForm({ name: "", type: "telegram", data: {} }); load(); };
  const remove = async (id: number) => { if (!confirm("حذف؟")) return; await fetch(`/api/credentials/${id}`, { method: "DELETE" }); load(); };
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="اعتبارنامه‌ها" subtitle="ذخیره امن با AES-256-GCM • پشتیبانی از External Secret Store (Vault) از طریق env" actions={<button className="ff-btn-primary" onClick={() => { setForm({ name: "", type: "telegram", data: {} }); setOpen(true); }}>＋ اعتبارنامه جدید</button>} />
      <div className="ff-card overflow-hidden"><table className="ff-table"><thead><tr><th>نام</th><th>نوع</th><th>فیلدها (ماسک‌شده)</th><th>ایجاد</th><th></th></tr></thead>
        <tbody>{list.map((c) => <tr key={c.id}><td className="font-medium">{c.name}</td><td><span className="ff-badge bg-[#1a2347] text-slate-300">{c.type}</span></td><td className="ff-mono text-xs text-slate-400" dir="ltr">{Object.entries(c.data).map(([k, v]) => `${k}=${v}`).join("  ")}</td><td className="text-xs text-slate-400">{fmtDate(c.createdAt)}</td><td className="text-xs whitespace-nowrap"><button className="text-orange-300 ml-2" onClick={() => { setForm({ id: c.id, name: c.name, type: c.type, data: {} }); setOpen(true); }}>ویرایش</button><button className="text-red-300" onClick={() => remove(c.id)}>حذف</button></td></tr>)}
        {!list.length && <tr><td colSpan={5} className="text-center text-slate-500 py-10">اعتبارنامه‌ای ثبت نشده. برای بله/تلگرام توکن ربات را اضافه کنید.</td></tr>}</tbody></table></div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "ویرایش اعتبارنامه" : "اعتبارنامه جدید"}>
        <div className="space-y-3">
          <div><label className="ff-label">نام</label><input className="ff-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="ff-label">نوع</label><select className="ff-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, data: {} })}>{CREDENTIAL_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select></div>
          {def.fields.map((f) => <div key={f}><label className="ff-label">{f}</label><input dir="ltr" className="ff-input ff-mono" type={/secret|password|token|key/i.test(f) ? "password" : "text"} value={form.data[f] ?? ""} onChange={(e) => setForm({ ...form, data: { ...form.data, [f]: e.target.value } })} placeholder={f === "authType" ? "bearer | basic | header" : f === "provider" ? "openai | anthropic | google | ollama | codex" : ""} /></div>)}
          {form.type === "codex" && <div className="text-[11px] text-slate-400 bg-[#0b1020] rounded p-2">برای Codex: با <code className="ff-mono">codex login --device-code</code> وارد شوید و توکن را از <code className="ff-mono">~/.codex/auth.json</code> در فیلد accessToken قرار دهید (بدون نیاز به API Key پولی).</div>}
          <div className="flex justify-end gap-2"><button className="ff-btn-ghost" onClick={() => setOpen(false)}>انصراف</button><button className="ff-btn-primary" onClick={save}>ذخیره</button></div>
        </div>
      </Modal>
    </div>
  );
}
