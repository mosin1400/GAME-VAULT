"use client";
// اجزای ویرایشگر: نود سفارشی React Flow، پالت نودها، پنل پارامترها
import { memo, useEffect, useMemo, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { CATEGORIES, type ParamDef } from "@/lib/nodes/catalog";
import { useNodeCatalog } from '@/components/NodeCatalogProvider';
import type { WorkflowNode, NodeRunResult } from "@/db/schema";

export type FFNodeData = { wn: WorkflowNode; result?: NodeRunResult; running?: boolean };
export type FFNode = Node<FFNodeData, "ff">;

// ---------------------------------------------------------------------------
// نود سفارشی روی بوم
// ---------------------------------------------------------------------------
export const FlowNode = memo(function FlowNode({ data, selected }: NodeProps<FFNode>) {
  const { getNodeDef } = useNodeCatalog();
  const def = getNodeDef(data.wn.type);
  const r = data.result;
  const ring = data.running ? "ring-2 ring-sky-400 animate-pulse" : r?.status === "success" ? "ring-2 ring-emerald-500" : r?.status === "error" ? "ring-2 ring-red-500" : r?.status === "skipped" ? "ring-2 ring-slate-500" : selected ? "ring-2 ring-orange-400" : "";
  const outs = def.outputs.length ? def.outputs : ["main"];
  return (
    <div dir="rtl" className={`relative rounded-xl border border-[#2a3660] bg-[#141c3a] min-w-[190px] max-w-[240px] shadow-lg ${ring} ${data.wn.disabled ? "opacity-50" : ""}`}>
      {def.inputs > 0 && (def.inputs === 1 ? <Handle type="target" position={Position.Left} id="in0" /> : [0, 1].map((i) => <Handle key={i} type="target" position={Position.Left} id={`in${i}`} style={{ top: `${35 + i * 30}%` }} />))}
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: `${def.color}22`, borderBottom: `1px solid ${def.color}55` }}>
        <span className="text-xl">{def.icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{data.wn.name}</div>
          <div className="text-[10px] text-slate-400 truncate">{def.name}</div>
        </div>
        {def.trigger && <span className="mr-auto text-[10px] text-emerald-300">⚡</span>}
      </div>
      <div className="px-3 py-1.5 text-[10px] text-slate-400 flex justify-between items-center">
        <span>{r ? (r.status === "error" ? "خطا" : r.status === "skipped" ? "رد شد" : `${r.output.length} آیتم`) : def.category}</span>
        {r?.durationMs != null && r.status !== "skipped" && <span className="ff-mono">{r.durationMs}ms</span>}
      </div>
      {outs.map((h, i) => (
        <div key={h}>
          <Handle type="source" position={Position.Right} id={h} style={{ top: outs.length === 1 ? "50%" : `${(100 / (outs.length + 1)) * (i + 1)}%`, background: h === "true" || h === "approved" || h === "pass" || h === "done" ? "#22c55e" : h === "false" || h === "rejected" || h === "blocked" ? "#ef4444" : h === "loop" ? "#f97316" : undefined }} />
          {outs.length > 1 && <span className="absolute text-[9px] text-slate-400 -right-1 translate-x-full pl-1.5" style={{ top: `calc(${(100 / (outs.length + 1)) * (i + 1)}% - 7px)`, direction: "ltr" }}>{h}</span>}
        </div>
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// پالت نودها (جستجو + دسته‌بندی + درگ)
// ---------------------------------------------------------------------------
export function NodePalette({ onAdd }: { onAdd: (type: string) => void }) {
  const { catalog: NODE_CATALOG } = useNodeCatalog();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return NODE_CATALOG.filter((n) => (cat === "all" || n.category === cat) && (!ql || n.name.toLowerCase().includes(ql) || n.type.toLowerCase().includes(ql) || n.description.includes(ql))).slice(0, 300);
  }, [q, cat, NODE_CATALOG]);
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[#1f2a4d]">
        <input className="ff-input" placeholder={`جستجو در ${NODE_CATALOG.length} نود…`} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1 mt-2 max-h-24 overflow-auto">
          <button onClick={() => setCat("all")} className={`ff-badge ${cat === "all" ? "bg-orange-500/20 text-orange-300" : "bg-[#1a2347] text-slate-300"}`}>همه</button>
          {CATEGORIES.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={`ff-badge ${cat === c.id ? "bg-orange-500/20 text-orange-300" : "bg-[#1a2347] text-slate-300"}`}>{c.icon} {c.label}</button>)}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {list.map((n) => (
          <div key={n.type} draggable onDragStart={(e) => { e.dataTransfer.setData("application/ff-node", n.type); e.dataTransfer.effectAllowed = "move"; }} onClick={() => onAdd(n.type)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-grab hover:bg-[#1a2347] border border-transparent hover:border-[#2a3660]">
            <span className="text-lg w-7 text-center">{n.icon}</span>
            <div className="min-w-0"><div className="text-xs font-medium truncate">{n.name}</div><div className="text-[10px] text-slate-500 truncate">{n.description}</div></div>
            {n.trigger && <span className="mr-auto text-[10px] text-emerald-300">⚡</span>}
          </div>
        ))}
        {!list.length && <div className="text-center text-slate-500 text-xs py-6">نودی یافت نشد</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// پنل پارامترهای نود انتخاب‌شده
// ---------------------------------------------------------------------------
type Cred = { id: number; name: string; type: string };

export function NodePanel({ wn, result, onChange, onDelete, onRunUntil, onClose }: { wn: WorkflowNode; result?: NodeRunResult; onChange: (n: WorkflowNode) => void; onDelete: () => void; onRunUntil: () => void; onClose: () => void }) {
  const { getNodeDef } = useNodeCatalog();
  const def = getNodeDef(wn.type);
  const [creds, setCreds] = useState<Cred[]>([]);
  const [tab, setTab] = useState<"params" | "output" | "settings">("params");
  useEffect(() => { fetch("/api/credentials").then((r) => r.json()).then(setCreds).catch(() => {}); }, []);
  const setParam = (k: string, v: unknown) => onChange({ ...wn, parameters: { ...wn.parameters, [k]: v } });
  const relevantCreds = creds.filter((c) => !def.credentialType || c.type === def.credentialType || c.type === "generic" || c.type === "httpAuth" || c.type === "oauth2");
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b border-[#1f2a4d]" style={{ background: `${def.color}15` }}>
        <span className="text-2xl">{def.icon}</span>
        <div className="min-w-0 flex-1"><input className="bg-transparent font-semibold text-sm outline-none w-full" value={wn.name} onChange={(e) => onChange({ ...wn, name: e.target.value })} /><div className="text-[11px] text-slate-400 truncate">{def.description}</div></div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
      </div>
      <div className="flex border-b border-[#1f2a4d] text-xs">
        {(["params", "output", "settings"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 ${tab === t ? "text-orange-300 border-b-2 border-orange-400" : "text-slate-400"}`}>{t === "params" ? "پارامترها" : t === "output" ? `خروجی${result ? ` (${result.output.length})` : ""}` : "تنظیمات"}</button>)}
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {tab === "params" && (
          <>
            {def.credentialType && (
              <div><label className="ff-label">Credential ({def.credentialType})</label>
                <select className="ff-input" value={wn.credentialId ?? ""} onChange={(e) => onChange({ ...wn, credentialId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">— بدون Credential (شبیه‌سازی / env) —</option>
                  {relevantCreds.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                </select></div>
            )}
            {def.params.map((p) => <ParamField key={p.name} p={p} value={wn.parameters?.[p.name]} onChange={(v) => setParam(p.name, v)} />)}
            {!def.params.length && <div className="text-xs text-slate-500">این نود پارامتری ندارد.</div>}
            <div className="text-[11px] text-slate-500 pt-2 border-t border-[#1f2a4d]">💡 عبارت‌ها: <code className="ff-mono">{"={{ $json.field }}"}</code>، <code className="ff-mono">{"{{ $node[\"Name\"].json.x }}"}</code>، <code className="ff-mono">{"{{ $vars.KEY }}"}</code>، <code className="ff-mono">{"{{ $now }}"}</code>، <code className="ff-mono">{"{{ $jalali() }}"}</code></div>
          </>
        )}
        {tab === "output" && (
          <div>
            {!result && <div className="text-xs text-slate-500">هنوز اجرا نشده. روی «اجرا» یا «اجرا تا این نود» کلیک کنید.</div>}
            {result?.error && <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-300 mb-2">{result.error}</div>}
            {result && <pre dir="ltr" className="ff-mono text-[11px] bg-[#0b1020] rounded-lg p-2 overflow-auto max-h-[60vh] whitespace-pre-wrap">{JSON.stringify(result.output, null, 2)}</pre>}
          </div>
        )}
        {tab === "settings" && (
          <>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(wn.disabled)} onChange={(e) => onChange({ ...wn, disabled: e.target.checked })} /> غیرفعال کردن نود</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wn.parameters?.continueOnFail === true} onChange={(e) => setParam("continueOnFail", e.target.checked)} /> ادامه در صورت خطا (Continue on Fail)</label>
            <div><label className="ff-label">یادداشت</label><textarea className="ff-input h-20" value={wn.notes ?? ""} onChange={(e) => onChange({ ...wn, notes: e.target.value })} /></div>
            <div className="text-[11px] text-slate-500">نوع: <code className="ff-mono">{wn.type}</code> • هندلر: <code className="ff-mono">{def.handler}</code> • خروجی‌ها: {def.outputs.join(", ") || "—"}</div>
          </>
        )}
      </div>
      <div className="p-3 border-t border-[#1f2a4d] flex gap-2">
        <button onClick={onRunUntil} className="ff-btn-ghost flex-1 justify-center">▶ اجرا تا این نود</button>
        <button onClick={onDelete} className="ff-btn-danger">🗑</button>
      </div>
    </div>
  );
}

function ParamField({ p, value, onChange }: { p: ParamDef; value: unknown; onChange: (v: unknown) => void }) {
  const v = value ?? p.default ?? "";
  return (
    <div>
      <label className="ff-label">{p.label}</label>
      {p.type === "boolean" ? (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(v)} onChange={(e) => onChange(e.target.checked)} /> فعال</label>
      ) : p.type === "select" ? (
        <select className="ff-input" value={String(v)} onChange={(e) => onChange(e.target.value)}>{p.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      ) : p.type === "number" ? (
        <input className="ff-input" type="text" value={String(v)} onChange={(e) => onChange(/^-?\d+(\.\d+)?$/.test(e.target.value) ? Number(e.target.value) : e.target.value)} />
      ) : p.type === "code" || p.type === "json" || p.type === "textarea" ? (
        <textarea dir={p.type === "textarea" ? "auto" : "ltr"} className={`ff-input ${p.type === "code" ? "h-48" : "h-24"} ff-mono text-xs`} value={typeof v === "string" ? v : JSON.stringify(v, null, 2)} onChange={(e) => onChange(e.target.value)} placeholder={p.placeholder} spellCheck={false} />
      ) : (
        <input dir="auto" className="ff-input" value={String(v)} onChange={(e) => onChange(e.target.value)} placeholder={p.placeholder} />
      )}
      {p.description && <div className="text-[10px] text-slate-500 mt-0.5">{p.description}</div>}
    </div>
  );
}
