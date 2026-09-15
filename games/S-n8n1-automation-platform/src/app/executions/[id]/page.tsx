import { db } from "@/db";
import { executions, executionLogs } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-400",
  error: "bg-red-500/15 text-red-400",
  skipped: "bg-slate-700/40 text-slate-400",
  running: "bg-amber-500/15 text-amber-400",
};

export default async function ExecutionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(executions).where(eq(executions.id, Number(id))).limit(1);
  if (!rows.length) notFound();
  const execution = rows[0];
  const logs = await db.select().from(executionLogs).where(eq(executionLogs.executionId, Number(id))).orderBy(asc(executionLogs.startedAt));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/executions" className="text-sm text-slate-400 hover:text-white">← بازگشت به لیست اجراها</Link>
      <div className="mt-4 mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div>
          <h1 className="text-xl font-bold text-white">{execution.workflowName || `Workflow #${execution.workflowId}`}</h1>
          <p className="text-sm text-slate-400">اجرا #{execution.id} · حالت: {execution.mode} · شروع: {new Date(execution.startedAt).toLocaleString("fa-IR")}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${statusStyle[execution.status] || "bg-slate-700/40"}`}>{execution.status}</span>
      </div>

      {execution.error != null && (
        <div className="mb-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">
          <pre className="whitespace-pre-wrap">{JSON.stringify(execution.error, null, 2)}</pre>
        </div>
      )}

      <h2 className="mb-3 text-lg font-bold text-white">مراحل اجرا ({logs.length})</h2>
      <div className="space-y-3">
        {logs.map((log) => (
          <details key={log.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4" open={log.status === "error"}>
            <summary className="flex cursor-pointer items-center justify-between gap-3">
              <span className="font-semibold text-slate-100">{log.nodeName} <span className="text-slate-500">({log.nodeType})</span></span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {log.durationMs}ms
                <span className={`rounded-full px-2 py-0.5 font-semibold ${statusStyle[log.status] || "bg-slate-700/40 text-slate-300"}`}>{log.status}</span>
              </span>
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">ورودی</p>
                <pre dir="ltr" className="max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(log.input, null, 2)}</pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">خروجی</p>
                <pre dir="ltr" className="max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(log.output, null, 2)}</pre>
              </div>
            </div>
            {log.error && <p className="mt-2 text-sm text-red-400">خطا: {log.error}</p>}
          </details>
        ))}
        {logs.length === 0 && <p className="text-sm text-slate-500">لاگی ثبت نشده است.</p>}
      </div>
    </main>
  );
}
