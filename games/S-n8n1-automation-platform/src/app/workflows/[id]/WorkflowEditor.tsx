"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import Link from "next/link";
import type { workflows } from "@/db/schema";
import type { NodeDefinition, WorkflowNodeData } from "@/lib/workflow/types";
import { NodeDefsContext } from "./NodeDefsContext";
import AutomationNodeView from "./AutomationNodeView";
import NodeSidebar from "./NodeSidebar";
import NodePropertiesPanel from "./NodePropertiesPanel";

type WorkflowRow = typeof workflows.$inferSelect;
type RFNode = Node<WorkflowNodeData>;

const nodeTypes = { automationNode: AutomationNodeView };

function defaultParameters(def: NodeDefinition): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const p of def.properties) obj[p.name] = p.default ?? "";
  return obj;
}

function EditorInner({ workflow, allWorkflows }: { workflow: WorkflowRow; allWorkflows: { id: number; name: string }[] }) {
  const [name, setName] = useState(workflow.name);
  const [active, setActive] = useState(workflow.active);
  const [errorWorkflowId, setErrorWorkflowId] = useState<number | null>(workflow.errorWorkflowId);
  const [definitions, setDefinitions] = useState<NodeDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<{ status: string; executionId: number; error?: string } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<RFNode>(
    (Array.isArray(workflow.nodes) ? workflow.nodes : []) as RFNode[],
  );
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>(
    (Array.isArray(workflow.edges) ? workflow.edges : []) as Edge[],
  );

  useEffect(() => {
    fetch("/api/nodes")
      .then((r) => r.json())
      .then((d) => setDefinitions(d.definitions || []));
  }, []);

  const defsMap = useMemo(() => new Map(definitions.map((d) => [d.type, d])), [definitions]);

  const onConnect = useCallback(
    (connection: Connection) => setRfEdges((eds) => addEdge({ ...connection, id: nanoid(8) }, eds)),
    [setRfEdges],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/x-node-type");
      const def = defsMap.get(type);
      if (!def) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = nanoid(8);
      const newNode: RFNode = {
        id,
        type: "automationNode",
        position,
        data: { id, type: def.type, name: def.name, parameters: defaultParameters(def) },
      };
      setRfNodes((nds) => nds.concat(newNode));
    },
    [defsMap, screenToFlowPosition, setRfNodes],
  );

  const selectedNode = rfNodes.find((n) => n.id === selectedId);
  const selectedDef = selectedNode ? defsMap.get(selectedNode.data.type) : undefined;

  function updateSelectedNodeData(next: WorkflowNodeData) {
    setRfNodes((nds) => nds.map((n) => (n.id === selectedId ? { ...n, data: next } : n)));
  }

  function deleteSelectedNode() {
    setRfNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setRfEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nodes: rfNodes, edges: rfEdges, errorWorkflowId }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    await save();
    const res = await fetch(`/api/workflows/${workflow.id}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    const data = await res.json();
    setActive(data.workflow.active);
  }

  async function run() {
    await save();
    setRunning(true);
    setLastRun(null);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { source: "manual-run" } }),
      });
      const data = await res.json();
      setLastRun(res.ok ? { status: data.status, executionId: data.executionId, error: data.error } : { status: "error", executionId: 0, error: data.error });
    } catch (err) {
      setLastRun({ status: "error", executionId: 0, error: (err as Error).message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <NodeDefsContext.Provider value={defsMap}>
      <div className="flex h-[calc(100vh-57px)] flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2.5">
          <Link href="/workflows" className="text-slate-400 hover:text-white">←</Link>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-64 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-white outline-none focus:border-slate-700 focus:bg-slate-900"
          />
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/40 text-slate-400"}`}>
            {active ? "فعال" : "غیرفعال"}
          </span>

          <div className="mr-auto flex items-center gap-2">
            <select
              value={errorWorkflowId ?? ""}
              onChange={(e) => setErrorWorkflowId(e.target.value ? Number(e.target.value) : null)}
              title="Error Workflow"
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300"
            >
              <option value="">بدون Error Workflow</option>
              {allWorkflows.filter((w) => w.id !== workflow.id).map((w) => (
                <option key={w.id} value={w.id}>خطا → {w.name}</option>
              ))}
            </select>
            <Link href={`/executions?workflowId=${workflow.id}`} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
              تاریخچه اجرا
            </Link>
            <button onClick={toggleActive} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800">
              {active ? "غیرفعال‌سازی" : "فعال‌سازی"}
            </button>
            <button onClick={save} disabled={saving} className="rounded-lg border border-indigo-600 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/10 disabled:opacity-50">
              {saving ? "در حال ذخیره..." : "ذخیره"}
            </button>
            <button onClick={run} disabled={running} className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50">
              {running ? "در حال اجرا..." : "▶ اجرا"}
            </button>
          </div>
        </div>

        {lastRun && (
          <div className={`px-4 py-2 text-xs ${lastRun.status === "success" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
            {lastRun.status === "success" ? "✅ اجرا با موفقیت به پایان رسید." : `❌ خطا: ${lastRun.error}`}
            {lastRun.executionId > 0 && (
              <>
                {" "}
                <Link href={`/executions/${lastRun.executionId}`} className="underline">مشاهده جزئیات اجرا</Link>
              </>
            )}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <div ref={wrapperRef} className="relative flex-1" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              onNodeClick={(_e, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              colorMode="dark"
              fitView
            >
              <Background gap={16} />
              <Controls />
              <MiniMap pannable zoomable className="!bg-slate-900" />
            </ReactFlow>
          </div>

          {selectedNode && (
            <NodePropertiesPanel
              def={selectedDef}
              nodeData={selectedNode.data}
              onChange={updateSelectedNodeData}
              onClose={() => setSelectedId(null)}
              onDelete={deleteSelectedNode}
            />
          )}

          <NodeSidebar definitions={definitions} />
        </div>
      </div>
    </NodeDefsContext.Provider>
  );
}

export default function WorkflowEditor(props: { workflow: WorkflowRow; allWorkflows: { id: number; name: string }[] }) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}
