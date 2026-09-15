"use client";
// تنظیمات: Worker View، کاربران/RBAC، امنیت، محیط‌ها، REST API
import { useEffect, useState } from "react";
import { PageHeader, StatusBadge, Stat } from "@/components/ui";
type Workers = { mode: string; redis: boolean; multiMain: boolean; running: { executionId: number; workflowId: number; startedAt: number }[]; workers: { id: string; role: string; status: string; concurrency: number; running: number; uptimeSec: number; memoryMb: number; cpuLoad: number }[] };
type U = { id: number; email: string; name: string; role: string; twoFactorEnabled: boolean };
export default function SettingsPage() {
  const [w, setW] = useState<Workers | null>(null);
  const [users, setUsers] = useState<U[]>([]);
  const [form, setForm] = useState({ email: "", name: "", role: "editor", twoFactorEnabled: true });
  const loadUsers = () => fetch("/api/users").then((r) => r.json()).then(setUsers);
  useEffect(() => { const l = () => fetch("/api/workers").then((r) => r.json()).then(setW); l(); loadUsers(); const t = setInterval(l, 5000); return () => clearInterval(t); }, []);
  const addUser = async () => { if (!form.email) return; await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); setForm({ email: "", name: "", role: "editor", twoFactorEnabled: true }); loadUsers(); };
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader title="تنظیمات و Worker View" subtitle="مقیاس‌پذیری، امنیت، تیم و API" />
      <section>
        <h2 className="font-semibold mb-3">🧵 Worker View</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <Stat label="حالت اجرا" value={w?.mode === "queue" ? "Queue" : "Regular"} hint="EXECUTIONS_MODE=queue برای Workerهای متعدد" />
          <Stat label="Redis" value={w ? (w.redis ? "متصل" : "پیکربندی‌نشده") : "…"} hint="REDIS_URL" />
          <Stat label="Multi-Main (HA)" value={w?.multiMain ? "فعال" : "غیرفعال"} hint="MULTI_MAIN=true" />
          <Stat label="اجراهای جاری" value={w?.running.length ?? 0} hint="۲۰۰+ اجرای همزمان در Queue Mode" />
        </div>
        <div className="ff-card overflow-hidden"><table className="ff-table"><thead><tr><th>Worker</th><th>نقش</th><th>وضعیت</th><th>Concurrency</th><th>در حال اجرا</th><th>Uptime</th><th>حافظه</th><th>CPU load</th></tr></thead>
          <tbody>{w?.workers.map((x) => <tr key={x.id}><td className="ff-mono">{x.id}</td><td>{x.role}</td><td><StatusBadge status={x.status} /></td><td className="ff-mono">{x.concurrency}</td><td className="ff-mono">{x.running}</td><td className="ff-mono">{Math.floor(x.uptimeSec / 60)}m</td><td className="ff-mono">{x.memoryMb} MB</td><td className="ff-mono">{x.cpuLoad.toFixed(2)}</td></tr>)}</tbody></table></div>
      </section>
      <section>
        <h2 className="font-semibold mb-3">👥 کاربران و نقش‌ها (RBAC)</h2>
        <div className="ff-card p-4 grid md:grid-cols-5 gap-2 mb-3">
          <input dir="ltr" className="ff-input" placeholder="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="ff-input" placeholder="نام" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="ff-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{["owner", "admin", "editor", "member", "viewer"].map((r) => <option key={r}>{r}</option>)}</select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.twoFactorEnabled} onChange={(e) => setForm({ ...form, twoFactorEnabled: e.target.checked })} /> 2FA اجباری</label>
          <button className="ff-btn-primary justify-center" onClick={addUser}>افزودن</button>
        </div>
        <div className="ff-card overflow-hidden"><table className="ff-table"><thead><tr><th>ایمیل</th><th>نام</th><th>نقش</th><th>2FA</th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td className="ff-mono" dir="ltr">{u.email}</td><td>{u.name}</td><td><span className="ff-badge bg-orange-500/10 text-orange-300">{u.role}</span></td><td>{u.twoFactorEnabled ? "✅" : "—"}</td></tr>)}</tbody></table></div>
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <div className="ff-card p-4 text-sm space-y-2">
          <h2 className="font-semibold">🔐 امنیت</h2>
          <ul className="text-slate-300 space-y-1">
            <li>• Encryption at Rest: AES-256-GCM (<code className="ff-mono">ENCRYPTION_KEY</code>)</li>
            <li>• SSO: SAML/OIDC از طریق <code className="ff-mono">SSO_ISSUER</code>, <code className="ff-mono">SSO_CLIENT_ID</code> (پشت Reverse Proxy مانند Authentik/Keycloak)</li>
            <li>• LDAP: <code className="ff-mono">LDAP_URL</code>, <code className="ff-mono">LDAP_BIND_DN</code></li>
            <li>• External Secret Store: <code className="ff-mono">VAULT_ADDR</code>, <code className="ff-mono">VAULT_TOKEN</code></li>
            <li>• Node-level Permissions: <code className="ff-mono">NODES_EXCLUDE=bash,pythonCode</code></li>
            <li>• Webhook auth token برای هر تریگر</li>
          </ul>
        </div>
        <div className="ff-card p-4 text-sm space-y-2">
          <h2 className="font-semibold">🧩 REST API</h2>
          <div className="ff-mono text-[11px] text-slate-300 space-y-1" dir="ltr">
            <div>GET/POST      /api/workflows</div>
            <div>GET/PUT/PATCH /api/workflows/:id</div>
            <div>POST          /api/workflows/:id/execute</div>
            <div>GET/POST      /api/workflows/:id/versions</div>
            <div>POST          /api/workflows/import</div>
            <div>GET           /api/executions?status=&q=</div>
            <div>GET/POST      /api/credentials • /api/variables • /api/users</div>
            <div>GET           /api/nodes • /api/templates • /api/stats • /api/audit • /api/workers</div>
            <div>POST          /api/ai/build  {"{ prompt }"}</div>
            <div>ANY           /api/webhook/:path</div>
          </div>
          <p className="text-slate-400 text-xs">CLI: <code className="ff-mono">./scripts/ffctl.sh list|export|import|run</code></p>
        </div>
      </section>
    </div>
  );
}
