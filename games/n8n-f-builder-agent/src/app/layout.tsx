import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Automation Builder Agent | n8n × Codex × Bale",
  description: "Agent سازندهٔ اتوماسیون: تبدیل درخواست زبان طبیعی به Workflow فعال در n8n",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;600;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <header className="sticky top-0 z-20 border-b border-[#1f2a4d] bg-[#0b1020]/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#7c8cff] to-[#34d399] text-lg font-black text-[#0b1020]">A</span>
              <div>
                <div className="text-sm font-bold">Automation Builder Agent</div>
                <div className="text-[11px] text-slate-400">n8n × Codex × Bale — خودتکامل‌شونده</div>
              </div>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-300">
              <Link href="/" className="hover:text-white">داشبورد</Link>
              <Link href="/docs" className="hover:text-white">مستندات</Link>
              <a href="/api/agent/status" target="_blank" className="hover:text-white">API</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-7xl px-6 pb-8 text-center text-xs text-slate-500">
          لایه‌ها: ورودی → مغز Agent (Codex) → سازندهٔ Workflow (n8n API / MCP) → اجراکننده و مانیتور (Self-Heal)
        </footer>
      </body>
    </html>
  );
}
