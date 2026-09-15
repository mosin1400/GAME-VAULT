"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [bootstrap, setBootstrap] = useState(false);
  const [email, setEmail] = useState("admin@flowforge.local");
  const [name, setName] = useState("مدیر FlowForge");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const endpoint = bootstrap ? "/api/auth/bootstrap" : "/api/auth/login";
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name, password }) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "عملیات ناموفق بود"); return; }
    router.replace("/");
  }

  return <main className="min-h-screen bg-[#070b16] flex items-center justify-center p-6 text-slate-100">
    <form onSubmit={submit} className="w-full max-w-md ff-card p-6 space-y-4">
      <div><h1 className="text-2xl font-bold">⚡ FlowForge</h1><p className="text-sm text-slate-400 mt-2">{bootstrap ? "راه‌اندازی اولین مدیر" : "ورود به پلتفرم اتوماسیون"}</p></div>
      {bootstrap && <input className="ff-input" placeholder="نام مدیر" value={name} onChange={(e) => setName(e.target.value)} required />}
      <input className="ff-input" dir="ltr" type="email" placeholder="ایمیل" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="ff-input" dir="ltr" type="password" placeholder="رمز عبور (حداقل ۱۲ کاراکتر)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />
      {error && <div className="text-sm text-red-300 bg-red-500/10 rounded p-3">{error}</div>}
      <button className="ff-btn-primary w-full justify-center" disabled={busy}>{busy ? "در حال بررسی…" : bootstrap ? "ساخت مدیر و ورود" : "ورود"}</button>
      <button type="button" className="text-xs text-slate-400 hover:text-orange-300" onClick={() => { setBootstrap(!bootstrap); setError(""); }}>{bootstrap ? "حساب دارم؛ ورود" : "راه‌اندازی اولیه"}</button>
    </form>
  </main>;
}
