"use client";
// کاتالوگ نودها – مرور ۵۰۰+ نود و یکپارچه‌سازی
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import { CATEGORIES, INTEGRATION_COUNT } from "@/lib/nodes/catalog";
import { useNodeCatalog } from '@/components/NodeCatalogProvider';
export default function NodesPage() {
  const { catalog: NODE_CATALOG } = useNodeCatalog();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const list = useMemo(() => { const ql = q.toLowerCase(); return NODE_CATALOG.filter((n) => (cat === "all" || n.category === cat) && (!ql || n.name.toLowerCase().includes(ql) || n.type.toLowerCase().includes(ql) || n.description.includes(ql))); }, [q, cat, NODE_CATALOG]);
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, NODE_CATALOG.filter((n) => n.category === c.id).length])), [NODE_CATALOG]);
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="کاتالوگ نودها" subtitle={`${NODE_CATALOG.length} نود داخلی • ${INTEGRATION_COUNT} یکپارچه‌سازی • ${NODE_CATALOG.filter((n) => n.trigger).length} تریگر • ساختار ماژولار برای افزودن نود جدید (custom-nodes/)`} />
      <input className="ff-input mb-3" placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap gap-1 mb-4"><button onClick={() => setCat("all")} className={`ff-badge ${cat === "all" ? "bg-orange-500/20 text-orange-300" : "bg-[#1a2347] text-slate-300"}`}>همه ({NODE_CATALOG.length})</button>{CATEGORIES.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={`ff-badge ${cat === c.id ? "bg-orange-500/20 text-orange-300" : "bg-[#1a2347] text-slate-300"}`}>{c.icon} {c.label} ({counts[c.id]})</button>)}</div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
        {list.slice(0, 400).map((n) => (
          <div key={n.type} className="ff-card p-3 flex gap-3 items-start">
            <span className="text-2xl w-9 h-9 flex items-center justify-center rounded-lg" style={{ background: `${n.color}22` }}>{n.icon}</span>
            <div className="min-w-0"><div className="font-medium text-sm flex items-center gap-2">{n.name}{n.trigger && <span className="text-[10px] text-emerald-300">تریگر</span>}</div><div className="text-xs text-slate-400">{n.description}</div><div className="text-[10px] text-slate-500 ff-mono mt-1" dir="ltr">{n.type} • {n.params.length} params</div></div>
          </div>
        ))}
      </div>
      {list.length > 400 && <div className="text-center text-slate-500 text-sm mt-4">{list.length - 400} نود دیگر… جستجو را محدود کنید</div>}
    </div>
  );
}
