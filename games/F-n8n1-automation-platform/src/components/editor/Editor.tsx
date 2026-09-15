"use client";
// ============================================================================
// Workflow Editor – ویرایشگر بصری Drag & Drop با React Flow
// اجرا، دیباگ实时، ذخیره با نسخه‌بندی، تنظیمات، Import/Export
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, useReactFlow,
  type Connection, type Edge, type OnConnect, BackgroundVariant,
} from "@xyflow/react";
import type { Workflow, WorkflowNode, WorkflowEdge, ExecutionResult, WorkflowSettings } from "@/db/schema";
import { useNodeCatalog } from '@/components/NodeCatalogProvider';
import { FlowNode, NodePalette, NodePanel, type FFNode } from "./parts";
import { Modal, StatusBadge, fmtDate } from "@/components/ui";

const nodeTypes = { ff: FlowNode };

const toRF = (n: WorkflowNode, result?: ExecutionResult): FFNode => ({ id: n.id, type: "ff", position: n.position, data: { wn: n, result: result?.nodes[n.id] } });
const toRFEdge = (e: WorkflowEdge): Edge => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? "main", targetHandle: e.targetHandle ?? "in0", label: e.sourceHandle && e.sourceHandle !== "main" ? e.sourceHandle : undefined, animated: e.sourceHandle === "loop", style: { stroke: e.sourceHandle === "true" ? "#22c55e" : e.sourceHandle === "false" ? "#ef4444" : undefined } });

function EditorInner({ id }: { id: number }) {
  const { getNodeDef, defaultParams } = useNodeCatalog();
  const [wf, setWf] = useState<Workflow | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<FFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [exec, setExec] = useState<{ status: string; error?: string; result: ExecutionResult; durationMs: number; executionId: number | null } | null>(null);
  const [showLogs, setShowLogs] = useState(true);
  const [showPalette, setShowPalette] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<{ id: number; version: number; message: string; createdAt: string; nodes: WorkflowNode[] }[]>([]);
  const [allWfs, setAllWfs] = useState<{ id: number; name: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  // بارگذاری
  useEffect(() => {
    fetch(`/api/workflows/${id}`).then((r) => r.json()).then((w: Workflow) => { setWf(w); setNodes(w.nodes.map((n) => toRF(n))); setEdges(w.edges.map(toRFEdge)); });
    fetch("/api/workflows").then((r) => r.json()).then((l: Workflow[]) => setAllWfs(l.map((x) => ({ id: x.id, name: x.name }))));
  }, [id, setNodes, setEdges]);

  const currentWorkflowNodes = useCallback((): WorkflowNode[] => nodes.map((n) => ({ ...n.data.wn, position: n.position })), [nodes]);
  const currentWorkflowEdges = useCallback((): WorkflowEdge[] => edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? "main", targetHandle: e.targetHandle ?? "in0" })), [edges]);

  const onConnect: OnConnect = useCallback((c: Connection) => { setEdges((eds) => addEdge(toRFEdge({ id: `e-${c.source}-${c.sourceHandle}-${c.target}-${c.targetHandle}-${Date.now()}`, source: c.source!, target: c.target!, sourceHandle: c.sourceHandle, targetHandle: c.targetHandle }), eds)); setDirty(true); }, [setEdges]);

  const addNode = useCallback((type: string, pos?: { x: number; y: number }) => {
    const def = getNodeDef(type);
    const count = nodes.filter((n) => n.data.wn.type === type).length;
    const nid = `n${Date.now().toString(36)}`;
    const position = pos ?? rf.screenToFlowPosition({ x: (wrapper.current?.clientWidth ?? 800) / 2, y: (wrapper.current?.clientHeight ?? 500) / 2 });
    const wn: WorkflowNode = { id: nid, type, name: count ? `${def.name} ${count + 1}` : def.name, position, parameters: defaultParams(type) };
    setNodes((ns) => [...ns, toRF(wn)]);
    setSelected(nid);
    setDirty(true);
  }, [nodes, rf, setNodes, getNodeDef, defaultParams]);

  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); const type = e.dataTransfer.getData("application/ff-node"); if (!type) return; addNode(type, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })); }, [addNode, rf]);

  const updateNode = (wn: WorkflowNode) => { setNodes((ns) => ns.map((n) => (n.id === wn.id ? { ...n, data: { ...n.data, wn } } : n))); setDirty(true); };
  const deleteNode = (nid: string) => { setNodes((ns) => ns.filter((n) => n.id !== nid)); setEdges((es) => es.filter((e) => e.source !== nid && e.target !== nid)); setSelected(null); setDirty(true); };

  const save = async (extra: Partial<Workflow> = {}) => {
    if (!wf) return;
    setSaving(true);
    const body = { ...wf, ...extra, nodes: currentWorkflowNodes(), edges: currentWorkflowEdges() };
    const r = await fetch(`/api/workflows/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    setWf(r); setDirty(false); setSaving(false); notify(`ذخیره شد (v${r.version})`);
  };

  const run = async (untilNodeId?: string) => {
    setRunning(true);
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, result: undefined, running: true } })));
    try {
      const r = await fetch(`/api/workflows/${id}/execute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nodes: currentWorkflowNodes(), edges: currentWorkflowEdges(), untilNodeId, mode: "manual" }) }).then((r) => r.json());
      setExec(r);
      setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, result: r.result?.nodes?.[n.id], running: false } })));
      notify(r.status === "success" ? `اجرا موفق (${r.durationMs}ms)` : `خطا: ${r.error}`);
    } catch (e) { notify("خطا در اجرا: " + (e as Error).message); setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, running: false } }))); }
    setRunning(false);
    setShowLogs(true);
  };

  const toggleActive = async () => { if (!wf) return; const r = await fetch(`/api/workflows/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !wf.active }) }).then((r) => r.json()); setWf(r); notify(r.active ? "جریان فعال شد – تریگرها گوش می‌دهند" : "جریان غیرفعال شد"); };
  const openVersions = async () => { setVersions(await fetch(`/api/workflows/${id}/versions`).then((r) => r.json())); setVersionsOpen(true); };
  const restore = async (v: number) => { const r = await fetch(`/api/workflows/${id}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: v }) }).then((r) => r.json()); setWf(r); setNodes(r.nodes.map((n: WorkflowNode) => toRF(n))); setEdges(r.edges.map(toRFEdge)); setVersionsOpen(false); notify(`بازگردانی به v${v}`); };
  const exportJson = () => { const blob = new Blob([JSON.stringify({ ...wf, nodes: currentWorkflowNodes(), edges: currentWorkflowEdges() }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${wf?.name}.json`; a.click(); };

  // میانبر Ctrl+S / Ctrl+Enter
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); } if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); });

  const selNode = useMemo(() => nodes.find((n) => n.id === selected), [nodes, selected]);
  const webhookNodes = nodes.filter((n) => ["webhookTrigger", "baleTrigger", "telegramTrigger", "soroushTrigger"].includes(n.data.wn.type) || n.data.wn.type.endsWith(".trigger"));

  if (!wf) return <div className="p-10 text-slate-400">در حال بارگذاری…</div>;

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <header className="flex items-center gap-2 px-3 py-2 border-b border-[#1f2a4d] bg-[#0d1428]">
        <Link href="/workflows" className="ff-btn-ghost px-2">→</Link>
        <input className="bg-transparent font-bold text-base outline-none min-w-[200px]" value={wf.name} onChange={(e) => { setWf({ ...wf, name: e.target.value }); setDirty(true); }} />
        <StatusBadge status={wf.active ? "active" : "inactive"} />
        <span className="text-xs text-slate-500 ff-mono">v{wf.version}</span>
        <span className="ff-badge bg-sky-500/10 text-sky-300">{wf.environment}</span>
        {dirty && <span className="text-xs text-amber-300">● ذخیره‌نشده</span>}
        <div className="mr-auto flex items-center gap-2">
          <button onClick={() => setShowPalette((v) => !v)} className="ff-btn-ghost">＋ نود</button>
          <button onClick={() => run()} disabled={running} className="ff-btn-primary">{running ? "⏳ در حال اجرا…" : "▶ اجرا"}</button>
          <button onClick={() => save()} disabled={saving} className="ff-btn-ghost">{saving ? "…" : "💾 ذخیره"}</button>
          <button onClick={toggleActive} className={`ff-btn-ghost ${wf.active ? "text-emerald-300" : ""}`}>{wf.active ? "⏸ غیرفعال" : "⚡ فعال‌سازی"}</button>
          <button onClick={openVersions} className="ff-btn-ghost">🕓 نسخه‌ها</button>
          <button onClick={() => setSettingsOpen(true)} className="ff-btn-ghost">⚙️</button>
          <button onClick={exportJson} className="ff-btn-ghost">⬇ Export</button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {showPalette && <aside className="w-72 shrink-0 border-l border-[#1f2a4d] bg-[#0d1428]"><NodePalette onAdd={(t) => addNode(t)} /></aside>}
        <div ref={wrapper} className="flex-1 relative" onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}>
          <ReactFlow<FFNode, Edge>
            nodes={nodes} edges={edges} nodeTypes={nodeTypes}
            onNodesChange={(c) => { onNodesChange(c); if (c.some((x) => x.type === "position" || x.type === "remove")) setDirty(true); }}
            onEdgesChange={(c) => { onEdgesChange(c); if (c.some((x) => x.type === "remove")) setDirty(true); }}
            onConnect={onConnect} onNodeClick={(_, n) => setSelected(n.id)} onPaneClick={() => setSelected(null)}
            fitView deleteKeyCode={["Delete", "Backspace"]} snapToGrid snapGrid={[16, 16]} proOptions={{ hideAttribution: true }}>
            <Background variant={BackgroundVariant.Dots} gap={20} color="#1f2a4d" />
            <Controls position="bottom-left" />
            <MiniMap position="bottom-right" nodeColor={(n) => getNodeDef((n as FFNode).data.wn.type).color} maskColor="rgba(11,16,32,0.7)" />
          </ReactFlow>
          {webhookNodes.length > 0 && (
            <div className="absolute top-3 left-3 ff-card p-2 text-[11px] space-y-1 max-w-md" dir="ltr">
              {webhookNodes.map((n) => <div key={n.id} className="ff-mono text-slate-300">{wf.active ? "🟢" : "⚪"} {typeof window !== "undefined" ? window.location.origin : ""}/api/webhook/{String(n.data.wn.parameters?.path ?? "")}</div>)}
              {!wf.active && <div className="text-amber-300" dir="rtl">برای دریافت Webhook جریان را فعال کنید</div>}
            </div>
          )}
          {toast && <div className="absolute top-3 right-3 ff-card px-4 py-2 text-sm border-orange-500/40">{toast}</div>}
          {!nodes.length && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-500">نودی از پالت سمت راست بکشید یا روی آن کلیک کنید</div>}
        </div>
        {selNode && <aside className="w-96 shrink-0 border-r border-[#1f2a4d] bg-[#0d1428]"><NodePanel wn={selNode.data.wn} result={selNode.data.result} onChange={updateNode} onDelete={() => deleteNode(selNode.id)} onRunUntil={() => run(selNode.id)} onClose={() => setSelected(null)} /></aside>}
      </div>

      {/* Log panel */}
      <section className={`border-t border-[#1f2a4d] bg-[#0d1428] ${showLogs ? "h-48" : "h-9"} transition-all flex flex-col`}>
        <div className="flex items-center gap-3 px-3 h-9 text-xs shrink-0">
          <button onClick={() => setShowLogs((v) => !v)} className="text-slate-300">{showLogs ? "▾" : "▸"} لاگ اجرا</button>
          {exec && <><StatusBadge status={exec.status} /><span className="text-slate-400">{exec.durationMs}ms</span>{exec.executionId && <Link href={`/executions?id=${exec.executionId}`} className="text-orange-300">اجرای #{exec.executionId}</Link>}{exec.error && <span className="text-red-300 truncate">{exec.error}</span>}</>}
          <span className="mr-auto text-slate-500">Ctrl+S ذخیره • Ctrl+Enter اجرا • Delete حذف</span>
        </div>
        {showLogs && (
          <div className="flex-1 overflow-auto px-3 pb-2 ff-mono text-[11px] space-y-0.5" dir="ltr">
            {exec?.result.logs.map((l, i) => <div key={i} className={l.level === "error" ? "text-red-300" : l.level === "warn" ? "text-amber-300" : l.level === "debug" ? "text-slate-500" : "text-slate-300"}><span className="text-slate-600">{l.ts.slice(11, 23)}</span> [{l.level}] {l.message}</div>)}
            {!exec && <div className="text-slate-500">برای مشاهده لاگ، جریان را اجرا کنید.</div>}
          </div>
        )}
      </section>

      {/* Settings modal */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="⚙️ تنظیمات جریان">
        <div className="space-y-3">
          <div><label className="ff-label">توضیحات</label><textarea className="ff-input h-20" value={wf.description ?? ""} onChange={(e) => setWf({ ...wf, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="ff-label">محیط (Environment)</label><select className="ff-input" value={wf.environment} onChange={(e) => setWf({ ...wf, environment: e.target.value })}>{["dev", "staging", "prod"].map((e) => <option key={e}>{e}</option>)}</select></div>
            <div><label className="ff-label">پروژه</label><input className="ff-input" value={wf.project} onChange={(e) => setWf({ ...wf, project: e.target.value })} /></div>
          </div>
          <div><label className="ff-label">تگ‌ها (با کاما)</label><input className="ff-input" value={wf.tags?.join(", ") ?? ""} onChange={(e) => setWf({ ...wf, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></div>
          <div><label className="ff-label">Error Workflow (اجرا هنگام خطا)</label><select className="ff-input" value={wf.settings?.errorWorkflowId ?? ""} onChange={(e) => setWf({ ...wf, settings: { ...wf.settings, errorWorkflowId: e.target.value ? Number(e.target.value) : null } as WorkflowSettings })}><option value="">— هیچ —</option>{allWfs.filter((w) => w.id !== id).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="ff-label">Timeout (ثانیه)</label><input className="ff-input" type="number" value={wf.settings?.timeoutSeconds ?? 300} onChange={(e) => setWf({ ...wf, settings: { ...wf.settings, timeoutSeconds: Number(e.target.value) } })} /></div>
            <div><label className="ff-label">منطقه زمانی</label><input className="ff-input" value={wf.settings?.timezone ?? "Asia/Tehran"} onChange={(e) => setWf({ ...wf, settings: { ...wf.settings, timezone: e.target.value } })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wf.settings?.saveExecutions !== false} onChange={(e) => setWf({ ...wf, settings: { ...wf.settings, saveExecutions: e.target.checked } })} /> ذخیره تاریخچه اجرا</label>
          <div className="flex justify-end gap-2"><button className="ff-btn-ghost" onClick={() => setSettingsOpen(false)}>بستن</button><button className="ff-btn-primary" onClick={() => { save(); setSettingsOpen(false); }}>ذخیره</button></div>
        </div>
      </Modal>

      {/* Versions modal */}
      <Modal open={versionsOpen} onClose={() => setVersionsOpen(false)} title="🕓 تاریخچه نسخه‌ها (Version Control)">
        <table className="ff-table"><thead><tr><th>نسخه</th><th>پیام</th><th>نودها</th><th>زمان</th><th></th></tr></thead>
          <tbody>{versions.map((v) => <tr key={v.id}><td className="ff-mono">v{v.version}</td><td className="text-slate-400">{v.message || "—"}</td><td className="ff-mono">{v.nodes.length}</td><td className="text-xs text-slate-400">{fmtDate(v.createdAt)}</td><td>{v.version !== wf.version && <button className="text-orange-300 text-xs" onClick={() => restore(v.version)}>بازگردانی</button>}</td></tr>)}</tbody></table>
        <p className="text-[11px] text-slate-500 mt-3">برای Git integration، فایل‌های Export را در مخزن commit کنید یا از اسکریپت <code className="ff-mono">scripts/git-sync.sh</code> استفاده کنید.</p>
      </Modal>
    </div>
  );
}

export default function Editor({ id }: { id: number }) {
  return <ReactFlowProvider><EditorInner id={id} /></ReactFlowProvider>;
}
