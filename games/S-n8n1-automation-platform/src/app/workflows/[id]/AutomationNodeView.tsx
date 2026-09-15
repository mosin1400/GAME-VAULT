"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useNodeDefs } from "./NodeDefsContext";
import type { WorkflowNodeData } from "@/lib/workflow/types";

export default function AutomationNodeView({ data, selected }: NodeProps) {
  const defs = useNodeDefs();
  const nodeData = data as unknown as WorkflowNodeData;
  const def = defs.get(nodeData.type);
  const outputs = def?.outputs && def.outputs.length > 1 ? def.outputs : ["main"];
  const color = def?.color || "#475569";

  return (
    <div
      className={`rounded-xl border-2 bg-slate-900 shadow-lg transition ${selected ? "border-indigo-400" : "border-slate-700"}`}
      style={{ borderInlineStartWidth: 6, borderInlineStartColor: color }}
    >
      {!def?.isTrigger && <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-slate-500" />}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-xl leading-none">{def?.icon || "⚙️"}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">{nodeData.name || def?.name || nodeData.type}</p>
          <p className="truncate text-[11px] text-slate-500">{def?.category || nodeData.type}</p>
        </div>
        {nodeData.disabled && <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">غیرفعال</span>}
      </div>
      {outputs.map((out, i) => (
        <Handle
          key={out}
          type="source"
          position={Position.Right}
          id={out === "main" ? undefined : out}
          style={{ top: `${((i + 1) / (outputs.length + 1)) * 100}%` }}
          className="!h-3 !w-3 !bg-indigo-400"
        >
          {outputs.length > 1 && (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] text-slate-400">{out}</span>
          )}
        </Handle>
      ))}
    </div>
  );
}
