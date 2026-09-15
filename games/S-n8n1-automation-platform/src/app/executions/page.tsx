import { db } from "@/db";
import { executions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-400",
  error: "bg-red-500/15 text-red-400",
  running: "bg-amber-500/15 text-amber-400",
};
const statusLabel: Record<string, string> = { success: "موفق", error: "خطا", running: "در حال اجرا" };

export default async function ExecutionsPage({ searchParams }: { searchParams: Promise<{ workflowId?: string }> }) {
  const { workflowId } = await searchParams;
  const rows = workflowId
    ? await db.select().from(executions).where(eq(executions.workflowId, Number(workflowId))).orderBy(desc(executions.startedAt)).limit(100)
    : await db.select().from(executions).orderBy(desc(executions.startedAt)).limit(100);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-white">تاریخچه اجراها {workflowId ? `(Workflow #${workflowId})` : ""}</h1>
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-right">Workflow</th>
              <th className="px-4 py-3 text-right">حالت</th>
              <th className="px-4 py-3 text-right">وضعیت</th>
              <th className="px-4 py-3 text-right">زمان شروع</th>
              <th className="px-4 py-3 text-right">مدت (ms)</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950">
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-slate-900">
                <td className="px-4 py-3 text-slate-200">{e.workflowName || `#${e.workflowId}`}</td>
                <td className="px-4 py-3 text-slate-400">{e.mode}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[e.status] || "bg-slate-700/40 text-slate-300"}`}>
                    {statusLabel[e.status] || e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">{new Date(e.startedAt).toLocaleString("fa-IR")}</td>
                <td className="px-4 py-3 text-slate-400">{e.durationMs ?? "-"}</td>
                <td className="px-4 py-3">
                  <Link href={`/executions/${e.id}`} className="text-indigo-400 hover:underline">جزئیات</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">هنوز اجرایی ثبت نشده است.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
