"use client";

import { useEffect, useState } from "react";
import type { NodeDefinition, WorkflowNodeData } from "@/lib/workflow/types";

interface CredentialOption { id: number; name: string; type: string }

export default function NodePropertiesPanel({
  def,
  nodeData,
  onChange,
  onClose,
  onDelete,
}: {
  def: NodeDefinition | undefined;
  nodeData: WorkflowNodeData;
  onChange: (next: WorkflowNodeData) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [credentials, setCredentials] = useState<CredentialOption[]>([]);

  useEffect(() => {
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((d) => setCredentials(d.credentials || []))
      .catch(() => {});
  }, []);

  function updateParam(name: string, value: unknown) {
    onChange({ ...nodeData, parameters: { ...nodeData.parameters, [name]: value } });
  }

  const relevantCredentials = credentials.filter((c) => c.type === def?.credentialType);

  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{def?.icon}</span>
          <div>
            <p className="text-sm font-bold text-white">{def?.name || nodeData.type}</p>
            <p className="text-[11px] text-slate-500">{def?.description}</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400">نام نود</label>
          <input
            value={nodeData.name}
            onChange={(e) => onChange({ ...nodeData, name: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
          />
        </div>

        {def?.credentialType && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Credential ({def.credentialType})</label>
            <select
              value={nodeData.credentialId ?? ""}
              onChange={(e) => onChange({ ...nodeData, credentialId: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
            >
              <option value="">-- انتخاب کنید --</option>
              {relevantCredentials.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Credential جدید را از صفحه‌ی <a href="/credentials" target="_blank" className="text-indigo-400 underline">Credentialها</a> بسازید.
            </p>
          </div>
        )}

        {def?.properties.map((prop) => {
          const value = nodeData.parameters[prop.name] ?? prop.default ?? "";
          if (prop.type === "boolean") {
            return (
              <label key={prop.name} className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={Boolean(value)} onChange={(e) => updateParam(prop.name, e.target.checked)} />
                {prop.label}
              </label>
            );
          }
          if (prop.type === "options") {
            return (
              <div key={prop.name}>
                <label className="mb-1 block text-xs font-semibold text-slate-400">{prop.label}</label>
                <select
                  value={String(value)}
                  onChange={(e) => updateParam(prop.name, e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                >
                  {prop.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            );
          }
          if (prop.type === "number") {
            return (
              <div key={prop.name}>
                <label className="mb-1 block text-xs font-semibold text-slate-400">{prop.label}</label>
                <input
                  type="number"
                  value={String(value)}
                  onChange={(e) => updateParam(prop.name, Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
            );
          }
          if (prop.type === "text" || prop.type === "json" || prop.type === "code") {
            return (
              <div key={prop.name}>
                <label className="mb-1 block text-xs font-semibold text-slate-400">{prop.label}</label>
                <textarea
                  dir="ltr"
                  rows={prop.rows || 4}
                  value={String(value)}
                  onChange={(e) => updateParam(prop.name, e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-indigo-500"
                />
                {prop.description && <p className="mt-1 text-[11px] text-slate-500">{prop.description}</p>}
              </div>
            );
          }
          return (
            <div key={prop.name}>
              <label className="mb-1 block text-xs font-semibold text-slate-400">{prop.label}</label>
              <input
                value={String(value)}
                placeholder={prop.placeholder}
                onChange={(e) => updateParam(prop.name, e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
              />
              {prop.description && <p className="mt-1 text-[11px] text-slate-500">{prop.description}</p>}
            </div>
          );
        })}

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400">یادداشت</label>
          <textarea
            rows={2}
            value={nodeData.notes || ""}
            onChange={(e) => onChange({ ...nodeData, notes: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={Boolean(nodeData.disabled)} onChange={(e) => onChange({ ...nodeData, disabled: e.target.checked })} />
          غیرفعال کردن این نود
        </label>
      </div>

      <div className="border-t border-slate-800 px-4 py-3">
        <button onClick={onDelete} className="w-full rounded-lg border border-red-900 py-2 text-sm font-semibold text-red-400 hover:bg-red-950">
          حذف نود
        </button>
      </div>
    </aside>
  );
}
