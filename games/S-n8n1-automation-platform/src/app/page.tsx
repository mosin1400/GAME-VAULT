import { db } from "@/db";
import { workflows, executions } from "@/db/schema";
import { desc, gte } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const allWorkflows = await db.select().from(workflows);
  const activeCount = allWorkflows.filter((w) => w.active).length;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const todayExecutions = await db.select().from(executions).where(gte(executions.startedAt, since));
  const successToday = todayExecutions.filter((e) => e.status === "success").length;
  const errorToday = todayExecutions.filter((e) => e.status === "error").length;
  const successRate = todayExecutions.length ? Math.round((successToday / todayExecutions.length) * 100) : 100;

  const recentExecutions = await db.select().from(executions).orderBy(desc(executions.startedAt)).limit(8);

  const stats = [
    { label: "کل Workflowها", value: allWorkflows.length, icon: "🧩", color: "from-indigo-500 to-indigo-700" },
    { label: "Workflowهای فعال", value: activeCount, icon: "🟢", color: "from-emerald-500 to-emerald-700" },
    { label: "اجراهای امروز", value: todayExecutions.length, icon: "⚡", color: "from-amber-500 to-amber-700" },
    { label: "نرخ موفقیت امروز", value: `${successRate}%`, icon: "📈", color: "from-fuchsia-500 to-fuchsia-700" },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <section className="mb-10 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-10">
        <p className="text-sm uppercase tracking-widest text-indigo-400">FlowForge Automation Platform</p>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight text-white">
          اکوسیستم کامل اتوماسیون هوشمند سازمانی
        </h1>
        <p className="mt-4 max-w-3xl text-slate-300">
          ساخت Workflow با کشیدن‌و‌رهاکردن، اجرای موازی، AI Agent متصل به هر LLM، پایپ‌لاین RAG، نودهای اختصاصی
          بله/سروش/MQTT/Modbus/TCP و بیش از ۵۰ نود اجراپذیر واقعی به همراه کاتالوگ ۵۰۰+ یکپارچه‌سازی.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/workflows" className="rounded-xl bg-indigo-500 px-5 py-2.5 font-semibold text-white transition hover:bg-indigo-400">
            شروع ساخت Workflow
          </Link>
          <Link href="/nodes" className="rounded-xl border border-slate-700 px-5 py-2.5 font-semibold text-slate-200 transition hover:bg-slate-800">
            مرور کاتالوگ نودها
          </Link>
        </div>
      </section>

      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className={`mb-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${s.color} text-lg`}>{s.icon}</div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-sm text-slate-400">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-4 text-lg font-bold text-white">آخرین اجراها</h2>
          <div className="space-y-2">
            {recentExecutions.length === 0 && <p className="text-sm text-slate-500">هنوز اجرایی ثبت نشده است.</p>}
            {recentExecutions.map((e) => (
              <Link
                key={e.id}
                href={`/executions/${e.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm transition hover:border-indigo-600"
              >
                <div>
                  <p className="font-medium text-slate-100">{e.workflowName || `Workflow #${e.workflowId}`}</p>
                  <p className="text-xs text-slate-500">{new Date(e.startedAt).toLocaleString("fa-IR")} · {e.mode}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    e.status === "success" ? "bg-emerald-500/15 text-emerald-400" : e.status === "error" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {e.status === "success" ? "موفق" : e.status === "error" ? "خطا" : "در حال اجرا"}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Workflowهای اخیر</h2>
          <div className="space-y-2">
            {allWorkflows.length === 0 && <p className="text-sm text-slate-500">هنوز Workflowای ساخته نشده است.</p>}
            {allWorkflows.slice(0, 8).map((w) => (
              <Link
                key={w.id}
                href={`/workflows/${w.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm transition hover:border-indigo-600"
              >
                <div>
                  <p className="font-medium text-slate-100">{w.name}</p>
                  <p className="text-xs text-slate-500">به‌روزرسانی: {new Date(w.updatedAt).toLocaleString("fa-IR")}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${w.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/40 text-slate-400"}`}>
                  {w.active ? "فعال" : "غیرفعال"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
