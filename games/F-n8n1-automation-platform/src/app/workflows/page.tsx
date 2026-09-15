"use client";
// لیست جریان‌های کاری + ایجاد/Import/AI Builder
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, StatusBadge, Modal, fmtDate } from "@/components/ui";
import { useNodeCatalog } from '@/components/NodeCatalogProvider';
import type { CustomNodeSpec } from '@/lib/agent/node-spec';

type WF = { id: number; name: string; description: string; active: boolean; nodes: unknown[]; tags: string[]; environment: string; version: number; updatedAt: string };
type AgentDraft = { status: "draft"; name: string; explanation: string; nodes: { id: string; type: string; name: string }[]; edges: unknown[]; requirements: string[]; warnings: string[]; trace: { action: string; detail: string }[] };

function WorkflowsInner() {
  const { refresh: refreshCatalog } = useNodeCatalog();
  const [newNode, setNewNode] = useState<CustomNodeSpec | null>(null);
  const [reviewedCode, setReviewedCode] = useState(false);
  const [list, setList] = useState<WF[]>([]);
  const [q, setQ] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("هر روز ساعت ۹ صبح داده‌ها را از https://jsonplaceholder.typicode.com/posts بگیر، اگر تعدادشان بیشتر از ۱۰ بود در بله پیام بده");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiDraft, setAiDraft] = useState<AgentDraft | null>(null);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiMessage, setAiMessage] = useState("");
  const [aiHistory, setAiHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const aiController = useRef<AbortController | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const router = useRouter();
  const sp = useSearchParams();

  const load = useCallback(() => fetch("/api/workflows").then((r) => r.json()).then(setList), []);
  useEffect(() => { load(); }, [load]);

  const create = useCallback(async () => {
    const r = await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "جریان جدید", nodes: [{ id: "n1", type: "manualTrigger", name: "Manual Trigger", position: { x: 100, y: 200 }, parameters: { payload: "{}" } }], edges: [] }) });
    const wf = await r.json();
    router.push(`/workflows/${wf.id}`);
  }, [router]);

  useEffect(() => { if (sp.get("new") === "1") create(); }, [sp, create]);

  const toggle = async (wf: WF) => { await fetch(`/api/workflows/${wf.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !wf.active }) }); load(); };
  const remove = async (wf: WF) => { if (!confirm(`حذف "${wf.name}"؟`)) return; await fetch(`/api/workflows/${wf.id}`, { method: "DELETE" }); load(); };
  const duplicate = async (wf: WF) => { const full = await fetch(`/api/workflows/${wf.id}`).then((r) => r.json()); await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...full, id: undefined, name: full.name + " (کپی)" }) }); load(); };
  const exportWf = async (wf: WF) => { const full = await fetch(`/api/workflows/${wf.id}`).then((r) => r.json()); const blob = new Blob([JSON.stringify(full, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${wf.name}.json`; a.click(); };
  const aiBuild = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true); setAiError(""); setAiDraft(null); setNewNode(null); setReviewedCode(false);
    const controller = new AbortController(); aiController.current = controller;
    try {
      const response = await fetch("/api/ai/build", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: aiPrompt, history: aiHistory }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "ساخت ناموفق بود");
      if (result.status === "clarification") {
        setAiMessage(result.message); setAiQuestions(result.questions);
        setAiHistory([...aiHistory, { role: "user", content: aiPrompt }, { role: "assistant", content: `${result.message}\n${result.questions.join("\n")}` }]);
        setAiPrompt("");
      } else if (result.status === "draft") {
        setAiDraft(result); setAiQuestions([]);
        setAiHistory([...aiHistory, { role: "user", content: aiPrompt }, { role: "assistant", content: JSON.stringify({ name: result.name, nodes: result.nodes, edges: result.edges }).slice(0, 12000) }]);
        setAiPrompt("");
      } else if (result.status === 'node_draft') {
        setNewNode(result.spec); setAiQuestions([]);
        setAiHistory([...aiHistory, { role: 'user', content: aiPrompt }, { role: 'assistant', content: `پیشنهاد نود جدید ${result.spec.type}: ${result.spec.description}. هنوز نصب نشده است.` }]);
        setAiPrompt('');
      } else throw new Error("پاسخ ایجنت معتبر نیست");
    } catch (error) {
      setAiError(error instanceof Error && error.name === "AbortError" ? "درخواست لغو شد" : error instanceof Error ? error.message : "خطای ارتباط");
    } finally { setAiBusy(false); aiController.current = null; }
  };
  const installNewNode = async () => {
    if (!newNode || !reviewedCode) return;
    setAiBusy(true); setAiError('');
    try {
      const response = await fetch('/api/nodes/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spec: newNode, confirmCode: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'نصب ناموفق بود');
      await refreshCatalog();
      setAiHistory([...aiHistory, { role: 'user', content: `مدیر نود ${newNode.type} را نصب کرد؛ در جستجوی ابزارها آن را بررسی کن و برای درخواست قبلی استفاده کن.` }]);
      setNewNode(null); setReviewedCode(false);
      setAiPrompt('اتوماسیون قبلی را با بررسی نود تازه نصب‌شده ادامه بده.');
    } catch (e) { setAiError(e instanceof Error ? e.message : 'خطای نصب'); }
    finally { setAiBusy(false); }
  };
  const exportNewNode = () => {
    if (!newNode) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(newNode, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${newNode.type}.json`; link.click(); URL.revokeObjectURL(url);
  };
  const saveAiDraft = async () => {
    if (!aiDraft) return;
    setAiBusy(true); setAiError("");
    try {
      const response = await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentDraft: true, name: aiDraft.name, description: aiDraft.explanation, nodes: aiDraft.nodes, edges: aiDraft.edges, tags: ["ai-built"], settings: { saveExecutions: true } }) });
      const wf = await response.json();
      if (!response.ok || !wf.id) throw new Error(wf.error ?? "ذخیره ناموفق بود");
      router.push(`/workflows/${wf.id}`);
    } catch (error) { setAiError(error instanceof Error ? error.message : "خطای ذخیره"); }
    finally { setAiBusy(false); }
  };
  const doImport = async () => { try { const body = JSON.parse(importJson); await fetch("/api/workflows/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); setImportOpen(false); setImportJson(""); load(); } catch (e) { alert("JSON نامعتبر: " + (e as Error).message); } };

  const filtered = list.filter((w) => !q || w.name.includes(q) || w.tags?.some((t) => t.includes(q)));
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="جریان‌های کاری" subtitle={`${list.length} جریان • ${list.filter((w) => w.active).length} فعال`} actions={<>
        <button onClick={() => setAiOpen(true)} className="ff-btn-ghost">✨ ساخت با AI</button>
        <button onClick={() => setImportOpen(true)} className="ff-btn-ghost">📥 Import JSON</button>
        <button onClick={create} className="ff-btn-primary">＋ جریان جدید</button>
      </>} />
      <input className="ff-input mb-4" placeholder="جستجو بر اساس نام یا تگ…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="ff-card overflow-hidden">
        <table className="ff-table">
          <thead><tr><th>نام</th><th>وضعیت</th><th>نودها</th><th>محیط</th><th>نسخه</th><th>آخرین ویرایش</th><th></th></tr></thead>
          <tbody>
            {filtered.map((w) => (
              <tr key={w.id} className="hover:bg-[#151d3b]">
                <td><Link href={`/workflows/${w.id}`} className="font-medium hover:text-orange-300">{w.name}</Link><div className="text-xs text-slate-500 truncate max-w-md">{w.description}</div><div className="flex gap-1 mt-1">{w.tags?.map((t) => <span key={t} className="ff-badge bg-[#1a2347] text-slate-300">{t}</span>)}</div></td>
                <td><button onClick={() => toggle(w)} title="تغییر وضعیت"><StatusBadge status={w.active ? "active" : "inactive"} /></button></td>
                <td className="ff-mono">{w.nodes?.length ?? 0}</td>
                <td><span className="ff-badge bg-sky-500/10 text-sky-300">{w.environment}</span></td>
                <td className="ff-mono">v{w.version}</td>
                <td className="text-xs text-slate-400">{fmtDate(w.updatedAt)}</td>
                <td className="whitespace-nowrap text-xs">
                  <Link href={`/workflows/${w.id}`} className="text-orange-300 ml-2">ویرایش</Link>
                  <button onClick={() => duplicate(w)} className="text-slate-300 ml-2">کپی</button>
                  <button onClick={() => exportWf(w)} className="text-slate-300 ml-2">Export</button>
                  <button onClick={() => remove(w)} className="text-red-300">حذف</button>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} className="text-center text-slate-500 py-10">جریانی وجود ندارد. از «قالب‌ها» یا «ساخت با AI» شروع کنید.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={aiOpen} onClose={() => setAiOpen(false)} title="✨ AI Workflow Builder" wide>
        <p className="text-sm text-slate-400 mb-3">ایجنت Codex ابزارهای موجود را بررسی می‌کند و پیش‌نویس اتوماسیون می‌سازد. آدرس‌ها، ورودی‌ها، شرط‌ها و مقصد خروجی را توضیح دهید. رمزها و توکن‌ها را اینجا وارد نکنید؛ آن‌ها را در اعتبارنامه‌ها تنظیم کنید.</p>
        {aiHistory.length > 0 && <details className="text-sm mb-3"><summary>گفت‌وگو</summary>{aiHistory.map((m, i) => <p key={i} className="whitespace-pre-wrap my-2 text-slate-400">{m.role === "user" ? "شما" : "ایجنت"}: {m.content}</p>)}</details>}
        {aiQuestions.length > 0 && <div className="bg-sky-500/10 p-3 rounded mb-3 text-sm"><p>{aiMessage}</p><ol className="list-decimal list-inside mt-2">{aiQuestions.map((q, i) => <li key={i}>{q}</li>)}</ol></div>}
        <textarea className="ff-input h-32" placeholder={aiQuestions.length ? "پاسخ سؤال‌ها…" : "اتوماسیون موردنظر…"} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} disabled={aiBusy} maxLength={12000} />
        {aiError && <p role="alert" className="text-red-300 text-sm mt-3">{aiError}</p>}
        {aiBusy && <p role="status" className="text-orange-300 text-sm mt-3">در حال پردازش؛ انتخاب ابزار و بررسی جریان ممکن است چند دقیقه طول بکشد…</p>}
        {newNode && <div className="ff-card p-4 mt-3 space-y-3 text-sm">
          <h3 className="font-bold text-purple-300">نود جدید: {newNode.name} <span dir="ltr">({newNode.type})</span></h3>
          <p>{newNode.description}</p><p>{newNode.inputs} ورودی • خروجی‌ها: {newNode.outputs.join(', ')}</p>
          <table className="ff-table"><thead><tr><th>پارامتر</th><th>نوع</th><th>پیش‌فرض</th></tr></thead><tbody>{newNode.params.map(p => <tr key={p.name}><td>{p.label} ({p.name})</td><td>{p.type}</td><td>{JSON.stringify(p.default)}</td></tr>)}</tbody></table>
          <pre dir="ltr" className="bg-[#070b16] rounded p-3 overflow-auto max-h-80 text-xs">{newNode.code}</pre>
          <p className="text-amber-300">این کد هنوز تست اجرایی نشده است. فقط کد مورد اعتماد را نصب کنید؛ محدودیت زمان و فرآیند جدا، sandbox امنیتی نیست. نود به Credential انتخابی و داده‌های ورودی دسترسی دارد.</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={reviewedCode} onChange={e => setReviewedCode(e.target.checked)} />کد را بررسی کرده‌ام و نصب آن را تأیید می‌کنم.</label>
          <div className="flex gap-2"><button onClick={exportNewNode} className="ff-btn-ghost">دریافت مشخصات و کد</button><button onClick={installNewNode} className="ff-btn-primary" disabled={!reviewedCode || aiBusy}>نصب نود در کاتالوگ</button></div>
        </div>}
        {aiDraft && <div className="ff-card p-3 mt-3 space-y-3 text-sm">
          <h3 className="font-semibold">پیش‌نمایش: {aiDraft.name}</h3><p className="whitespace-pre-wrap">{aiDraft.explanation}</p>
          <ol className="list-decimal list-inside">{aiDraft.nodes.map((n) => <li key={n.id}>{n.name} <span className="ff-mono text-slate-400">({n.type})</span></li>)}</ol>
          {[...aiDraft.requirements, ...aiDraft.warnings].map((w, i) => <p key={i} className="text-amber-300">• {w}</p>)}
          <details><summary>JSON نودها و اتصال‌ها</summary><pre dir="ltr" className="overflow-auto max-h-72 text-xs mt-2">{JSON.stringify({ nodes: aiDraft.nodes, edges: aiDraft.edges }, null, 2)}</pre></details>
          <details><summary>ابزارهای بررسی‌شده توسط ایجنت</summary>{aiDraft.trace.map((t, i) => <p key={i} dir="ltr" className="ff-mono text-xs">{t.action}: {t.detail}</p>)}</details>
          <p className="text-slate-400">ذخیره، جریان را فعال یا اجرا نمی‌کند. تنظیمات و اعتبارنامه‌ها را در ویرایشگر بررسی کنید.</p>
        </div>}
        <div className="flex flex-wrap justify-end gap-2 mt-3">
          {aiBusy && aiController.current && <button className="ff-btn-ghost" onClick={() => aiController.current?.abort()}>لغو درخواست</button>}
          <button className="ff-btn-ghost" disabled={aiBusy} onClick={() => { setAiHistory([]); setAiQuestions([]); setAiDraft(null); setNewNode(null); setReviewedCode(false); setAiError(""); }}>گفت‌وگوی جدید</button>
          <button className="ff-btn-primary" disabled={aiBusy || !aiPrompt.trim()} onClick={aiBuild}>{aiQuestions.length ? "ارسال پاسخ" : aiDraft ? "اصلاح پیش‌نویس" : "ساخت با Codex"}</button>
          {aiDraft && <button className="ff-btn-primary" disabled={aiBusy} onClick={saveAiDraft}>ذخیره پیش‌نویس و بازکردن ویرایشگر</button>}
        </div>
      </Modal>
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="📥 Import Workflow (JSON)">
        <textarea className="ff-input h-64 ff-mono text-xs" placeholder='{"name": "...", "nodes": [...], "edges": [...]}' value={importJson} onChange={(e) => setImportJson(e.target.value)} />
        <div className="flex justify-end gap-2 mt-3"><button className="ff-btn-ghost" onClick={() => setImportOpen(false)}>انصراف</button><button className="ff-btn-primary" onClick={doImport}>Import</button></div>
      </Modal>
    </div>
  );
}

export default function WorkflowsPage() {
  return <Suspense fallback={<div className="p-6">…</div>}><WorkflowsInner /></Suspense>;
}
