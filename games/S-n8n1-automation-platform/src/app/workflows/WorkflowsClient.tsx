"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import type { workflows } from "@/db/schema";

type Workflow = typeof workflows.$inferSelect;

export default function WorkflowsClient({ initialWorkflows }: { initialWorkflows: Workflow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialWorkflows);
  const [creating, setCreating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  async function createBlank() {
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Workflow جدید", nodes: [], edges: [] }),
      });
      const data = await res.json();
      router.push(`/workflows/${data.workflow.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function createFromAi() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const genRes = await fetch("/api/ai/generate-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const gen = await genRes.json();
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: gen.name, nodes: gen.nodes, edges: gen.edges }),
      });
      const data = await res.json();
      router.push(`/workflows/${data.workflow.id}`);
    } finally {
      setAiLoading(false);
    }
  }

  async function toggleActive(w: Workflow) {
    const res = await fetch(`/api/workflows/${w.id}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !w.active }),
    });
    const data = await res.json();
    setItems((prev) => prev.map((it) => (it.id === w.id ? data.workflow : it)));
  }

  async function remove(w: Workflow) {
    if (!confirm(`Workflow «${w.name}» حذف شود؟`)) return;
    await fetch(`/api/workflows/${w.id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((it) => it.id !== w.id));
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Workflowها</h1>
          <p className="text-sm text-slate-400">همه‌ی Workflowهای شما در یک نگاه</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAiOpen(true)} className="rounded-xl border border-fuchsia-600 px-4 py-2 text-sm font-semibold text-fuchsia-300 transition hover:bg-fuchsia-600/10">
            ✨ ساخت با AI
          </button>
          <button disabled={creating} onClick={createBlank} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50">
            + Workflow جدید
          </button>
        </div>
      </div>

      {aiOpen && (
        <div className="mb-8 rounded-2xl border border-fuchsia-800 bg-fuchsia-950/30 p-5">
          <p className="mb-2 text-sm font-semibold text-fuchsia-200">توضیح دهید چه Workflowای می‌خواهید بسازید:</p>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={3}
            placeholder="مثال: وقتی وب‌هوک دریافت شد، پیام را به بله ارسال کن و در صورت خطا ایمیل بفرست"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:border-fuchsia-500"
          />
          <div className="mt-3 flex gap-2">
            <button onClick={createFromAi} disabled={aiLoading} className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50">
              {aiLoading ? "در حال ساخت..." : "ساخت Workflow"}
            </button>
            <button onClick={() => setAiOpen(false)} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
              انصراف
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((w) => (
          <div key={w.id} className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-3 flex items-start justify-between">
              <Link href={`/workflows/${w.id}`} className="text-lg font-bold text-white hover:text-indigo-300">
                {w.name}
              </Link>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${w.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/40 text-slate-400"}`}>
                {w.active ? "فعال" : "غیرفعال"}
              </span>
            </div>
            <p className="mb-4 line-clamp-2 flex-1 text-sm text-slate-400">{w.description || "بدون توضیحات"}</p>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{Array.isArray(w.nodes) ? w.nodes.length : 0} نود</span>
              <span>{new Date(w.updatedAt).toLocaleDateString("fa-IR")}</span>
            </div>
            <div className="mt-4 flex gap-2">
              <Link href={`/workflows/${w.id}`} className="flex-1 rounded-lg border border-slate-700 py-2 text-center text-xs font-semibold text-slate-200 hover:bg-slate-800">
                ویرایش
              </Link>
              <button onClick={() => toggleActive(w)} className="flex-1 rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
                {w.active ? "غیرفعال‌سازی" : "فعال‌سازی"}
              </button>
              <button onClick={() => remove(w)} className="rounded-lg border border-red-900 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950">
                حذف
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-500">هنوز Workflowای نساخته‌اید.</p>}
      </div>
    </main>
  );
}
