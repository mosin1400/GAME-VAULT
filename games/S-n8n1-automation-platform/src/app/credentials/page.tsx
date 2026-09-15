"use client";

import { useEffect, useState } from "react";

interface Credential { id: number; name: string; type: string; createdAt: string }

const CREDENTIAL_TYPES: { value: string; label: string; fields: { key: string; label: string; type?: string }[] }[] = [
  { value: "slackApi", label: "Slack", fields: [{ key: "webhookUrl", label: "Webhook URL" }, { key: "botToken", label: "Bot Token (اختیاری)" }] },
  { value: "telegramApi", label: "Telegram", fields: [{ key: "botToken", label: "Bot Token" }] },
  { value: "discordApi", label: "Discord", fields: [{ key: "webhookUrl", label: "Webhook URL" }] },
  { value: "baleApi", label: "بله (Bale)", fields: [{ key: "botToken", label: "Bot Token" }] },
  { value: "soroushApi", label: "سروش (Soroush)", fields: [{ key: "token", label: "Token" }] },
  { value: "smtp", label: "SMTP / Email", fields: [{ key: "host", label: "Host" }, { key: "port", label: "Port" }, { key: "user", label: "کاربر" }, { key: "pass", label: "رمز عبور", type: "password" }, { key: "secure", label: "secure (true/false)" }] },
  { value: "twilioApi", label: "Twilio", fields: [{ key: "accountSid", label: "Account SID" }, { key: "authToken", label: "Auth Token", type: "password" }, { key: "fromNumber", label: "شماره فرستنده" }] },
  { value: "postgres", label: "PostgreSQL", fields: [{ key: "connectionString", label: "Connection String" }] },
  { value: "llmApi", label: "LLM (OpenAI/Codex/Ollama/...)", fields: [{ key: "apiKey", label: "API Key" }, { key: "baseUrl", label: "Base URL (اختیاری)" }] },
  { value: "githubApi", label: "GitHub", fields: [{ key: "token", label: "Personal Access Token" }] },
  { value: "notionApi", label: "Notion", fields: [{ key: "apiKey", label: "Integration Token" }] },
  { value: "googleApi", label: "Google Workspace", fields: [{ key: "accessToken", label: "OAuth Access Token" }] },
];

export default function CredentialsPage() {
  const [items, setItems] = useState<Credential[]>([]);
  const [type, setType] = useState(CREDENTIAL_TYPES[0].value);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/credentials").then((r) => r.json()).then((d) => setItems(d.credentials || []));
  }
  useEffect(load, []);

  const currentType = CREDENTIAL_TYPES.find((t) => t.value === type)!;

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, data: fields }),
      });
      setName("");
      setFields({});
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("حذف شود؟")) return;
    await fetch(`/api/credentials/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-white">Credentialها</h1>
      <p className="mb-8 text-sm text-slate-400">کلیدهای API و توکن‌ها به‌صورت رمزنگاری‌شده (AES-256-GCM) ذخیره می‌شوند.</p>

      <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 font-bold text-white">افزودن Credential جدید</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">نوع</label>
              <select value={type} onChange={(e) => { setType(e.target.value); setFields({}); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
                {CREDENTIAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">نام دلخواه</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="مثلا: بات پشتیبانی بله" />
            </div>
            {currentType.fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-semibold text-slate-400">{f.label}</label>
                <input
                  type={f.type || "text"}
                  dir="ltr"
                  value={fields[f.key] || ""}
                  onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            ))}
            <button onClick={create} disabled={saving} className="w-full rounded-lg bg-indigo-500 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50">
              {saving ? "در حال ذخیره..." : "ذخیره Credential"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 font-bold text-white">Credentialهای موجود</h2>
          <div className="space-y-2">
            {items.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-100">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.type}</p>
                </div>
                <button onClick={() => remove(c.id)} className="text-xs text-red-400 hover:underline">حذف</button>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-slate-500">Credentialای ثبت نشده.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
