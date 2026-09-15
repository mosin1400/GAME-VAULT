"use client";

import { useMemo, useState } from "react";
import type { NodeDefinition } from "@/lib/workflow/types";

export default function NodeSidebar({ definitions }: { definitions: NodeDefinition[] }) {
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const filtered = definitions.filter(
      (d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.category.toLowerCase().includes(search.toLowerCase()),
    );
    const map = new Map<string, NodeDefinition[]>();
    for (const d of filtered) {
      if (!map.has(d.category)) map.set(d.category, []);
      map.get(d.category)!.push(d);
    }
    return map;
  }, [definitions, search]);

  function onDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData("application/x-node-type", type);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جست‌وجوی نود..."
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {Array.from(grouped.entries()).map(([category, defs]) => (
          <div key={category} className="mb-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{category}</p>
            <div className="space-y-1.5">
              {defs.map((d) => (
                <div
                  key={d.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, d.type)}
                  className="flex cursor-grab items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-sm transition hover:border-indigo-600 active:cursor-grabbing"
                  title={d.description}
                >
                  <span className="text-lg">{d.icon}</span>
                  <span className="truncate text-slate-200">{d.name}</span>
                  {d.isTrigger && <span className="mr-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-400">Trigger</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {grouped.size === 0 && <p className="text-xs text-slate-500">موردی پیدا نشد.</p>}
      </div>
    </aside>
  );
}
