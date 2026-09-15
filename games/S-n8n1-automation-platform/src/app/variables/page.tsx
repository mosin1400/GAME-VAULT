"use client";

import { useEffect, useState } from "react";

interface Variable { id: number; key: string; value: string }

export default function VariablesPage() {
  const [items, setItems] = useState<Variable[]>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  function load() {
    fetch("/api/variables").then((r) => r.json()).then((d) => setItems(d.variables || []));
  }
  useEffect(load, []);

  async function create() {
    if (!key.trim()) return;
    await fetch("/api/variables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
    setKey("");
    setValue("");
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/variables/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-white">متغیرهای سراسری (Global Variables)</h1>
      <p className="mb-8 text-sm text-slate-400">این متغیرها در آینده از طریق $vars در نود Code قابل استفاده هستند.</p>

      <div className="mb-6 flex gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="کلید (مثلا API_BASE_URL)" dir="ltr" className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="مقدار" dir="ltr" className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
        <button onClick={create} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">افزودن</button>
      </div>

      <div className="space-y-2">
        {items.map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
            <div dir="ltr" className="font-mono text-slate-100">{v.key} = <span className="text-indigo-300">{v.value}</span></div>
            <button onClick={() => remove(v.id)} className="text-xs text-red-400 hover:underline">حذف</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-500">متغیری ثبت نشده است.</p>}
      </div>
    </main>
  );
}
