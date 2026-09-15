"use client";

/**
 * فرم وب سادهٔ لایهٔ ۱: درخواست زبان طبیعی → POST /api/agent/build
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAMPLES = [
  "یک بات بله بساز که به کدکس وصل باشه و هر چی بگم رو ترجمه کنه",
  "یک اتوماسیون بساز که هر پیامی به بات بله بفرستم، آن را به Codex بفرستد و پاسخ را برایم برگرداند",
  "هر روز صبح ساعت ۹ یک خلاصهٔ انگیزشی با Codex بساز و در بله برام بفرست",
  "یک Webhook بساز که متن دریافتی را به Codex بدهد و خلاصهٔ آن را JSON برگرداند",
];

export default function BuildForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (prompt.trim().length < 5) {
      setError("درخواست را کامل‌تر بنویسید.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/agent/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userName: "web-user" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "خطای ناشناخته");
      router.push(`/requests/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }

  return (
    <div className="panel p-6">
      <h2 className="text-lg font-bold">درخواست جدید اتوماسیون</h2>
      <p className="mt-1 text-sm text-slate-400">
        به زبان طبیعی بگویید چه می‌خواهید؛ Agent آن را به Workflow کامل n8n تبدیل، اعتبارسنجی، ایجاد و فعال می‌کند.
      </p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder="مثلاً: یک بات بله بساز که به کدکس وصل باشه و هر چی بگم رو ترجمه کنه"
        className="mt-4 w-full resize-y rounded-xl border border-[#1f2a4d] bg-[#0b1020] p-4 text-sm outline-none focus:border-[#7c8cff]"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setPrompt(ex)}
            className="badge cursor-pointer text-slate-300 hover:border-[#7c8cff] hover:text-white"
          >
            {ex.length > 48 ? ex.slice(0, 48) + "…" : ex}
          </button>
        ))}
      </div>

      {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="rounded-xl bg-gradient-to-l from-[#7c8cff] to-[#5b6cff] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-900/40 disabled:opacity-50"
        >
          {loading ? "در حال ارسال به Agent..." : "بساز 🚀"}
        </button>
        <span className="text-xs text-slate-500">
          یا از بات بله: پیام بدهید تا همین کار انجام شود.
        </span>
      </div>
    </div>
  );
}
