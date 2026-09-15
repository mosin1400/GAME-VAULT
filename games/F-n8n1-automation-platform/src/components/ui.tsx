/* @jsx React.createElement */
"use client";
// @ts-nocheck
// کامپوننت‌های مشترک UI: Sidebar، Badge، PageHeader، Modal
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "داشبورد", icon: "📊" },
  { href: "/workflows", label: "جریان‌های کاری", icon: "🧩" },
  { href: "/executions", label: "تاریخچه اجرا", icon: "📜" },
  { href: "/templates", label: "قالب‌ها", icon: "📚" },
  { href: "/nodes", label: "کاتالوگ نودها", icon: "🔌" },
  { href: "/credentials", label: "اعتبارنامه‌ها", icon: "🔐" },
  { href: "/variables", label: "متغیرهای سراسری", icon: "🌍" },
  { href: "/audit", label: "Audit Log", icon: "🛡️" },
  { href: "/settings", label: "تنظیمات و Workerها", icon: "⚙️" },
];

export function Sidebar() {
  const path = usePathname();
  const isEditor = /^\/workflows\/\d+/.test(path);
  if (isEditor) return null;
  return (
    <aside className="w-60 shrink-0 border-l border-[#1f2a4d] bg-[#0d1428] p-4 flex flex-col gap-1 sticky top-0 h-screen">
      <Link href="/" className="flex items-center gap-2 px-2 py-3 mb-2">
        <span className="text-2xl">⚡</span>
        <div>
          <div className="font-bold text-lg leading-tight">FlowForge</div>
          <div className="text-[11px] text-slate-400">اتوماسیون هوشمند سازمانی</div>
        </div>
      </Link>
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-orange-500/15 text-orange-300" : "text-slate-300 hover:bg-[#1a2347]"}`}>
            <span>{n.icon}</span>
            {n.label}
          </Link>
        );
      })}
      <div className="mt-auto text-[11px] text-slate-500 px-2 space-y-1">
        <div>v1.0.0 • Self-hosted</div>
        <div>PostgreSQL • Redis • Docker</div>
      </div>
    </aside>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: "bg-emerald-500/15 text-emerald-300",
    error: "bg-red-500/15 text-red-300",
    running: "bg-sky-500/15 text-sky-300 animate-pulse",
    waiting: "bg-amber-500/15 text-amber-300",
    skipped: "bg-slate-500/15 text-slate-300",
    active: "bg-emerald-500/15 text-emerald-300",
    inactive: "bg-slate-500/15 text-slate-400",
    online: "bg-emerald-500/15 text-emerald-300",
    offline: "bg-red-500/15 text-red-300",
  };
  const fa: Record<string, string> = { success: "موفق", error: "خطا", running: "در حال اجرا", waiting: "در انتظار", skipped: "رد شده", active: "فعال", inactive: "غیرفعال", online: "آنلاین", offline: "آفلاین" };
  return <span className={`ff-badge ${map[status] ?? "bg-slate-500/15 text-slate-300"}`}>{fa[status] ?? status}</span>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className={`ff-card w-full ${wide ? "max-w-4xl" : "max-w-lg"} max-h-[90vh] overflow-auto p-5`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: string }) {
  return (
    <div className="ff-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">{label}</div>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export const fmtDate = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleString("fa-IR") : "—");
export const fmtMs = (ms: number | null | undefined) => (ms == null ? "—" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
