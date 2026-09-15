"use client";
// قالب‌های آماده – جستجو و استفاده
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
type T = { id: string; name: string; description: string; category: string; tags: string[]; nodeCount: number };
export default function TemplatesPage() {
  const [data, setData] = useState<{ total: number; filtered: number; templates: T[] } | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => { const t = setTimeout(() => fetch(`/api/templates?q=${encodeURIComponent(q)}&limit=120`).then((r) => r.json()).then(setData), 200); return () => clearTimeout(t); }, [q]);
  const use = async (id: string) => { setBusy(id); const wf = await fetch(`/api/templates/${id}`, { method: "POST" }).then((r) => r.json()); router.push(`/workflows/${wf.id}`); };
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="قالب‌های آماده" subtitle={`${data?.total ?? "…"} قالب • ${data?.filtered ?? 0} نتیجه`} />
      <input className="ff-input mb-4" placeholder="جستجو: بله، RAG، MQTT، Stripe، Google Sheets…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {data?.templates.map((t) => (
          <div key={t.id} className="ff-card p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2"><div className="font-semibold">{t.name}</div><span className="ff-badge bg-[#1a2347] text-slate-300 shrink-0">{t.category}</span></div>
            <div className="text-xs text-slate-400 flex-1">{t.description}</div>
            <div className="flex flex-wrap gap-1">{t.tags.slice(0, 4).map((x) => <span key={x} className="ff-badge bg-orange-500/10 text-orange-300">{x}</span>)}</div>
            <div className="flex items-center justify-between mt-1"><span className="text-[11px] text-slate-500">{t.nodeCount} نود</span><button disabled={busy === t.id} onClick={() => use(t.id)} className="ff-btn-primary py-1">{busy === t.id ? "…" : "استفاده"}</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}
