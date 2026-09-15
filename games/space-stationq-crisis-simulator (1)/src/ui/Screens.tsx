/* ============================================================
   Screens — بوت، مودال تصمیم اخلاقی و صفحه‌ی پایان
   Boot sequence, moral-decision modal and ending screen.
   ============================================================ */
import { useEffect, useState } from "react";
import { ASCII_LOGO, ASCII_STATION } from "../game/data";
import type { Ending, Scenario } from "../game/types";
import { toFa } from "./Hud";
import { cn } from "../utils/cn";

/* ─────────── توالی بوت / Boot sequence ─────────── */
const BOOT_LINES: { text: string; cls: string; d: number }[] = [
  { text: "AVICENNA STATION OS v3.7 — KERNEL 9.1.4", cls: "text-crt-dim", d: 200 },
  { text: "MEMORY CHECK ................ 65536 OK", cls: "text-crt-green/70", d: 650 },
  { text: "REACTOR CORE ................ ONLINE", cls: "text-crt-green/70", d: 1100 },
  { text: "O2 RECYCLER ................. ONLINE", cls: "text-crt-green/70", d: 1500 },
  { text: "SOLAR ARRAY ................. 78% YIELD", cls: "text-crt-yellow/80", d: 1900 },
  { text: "COMMS UPLINK ................ DEGRADED ⚠", cls: "text-crt-red/80", d: 2350 },
  { text: "CREW LIFE-SIGNS ............. 12/12", cls: "text-crt-cyan/80", d: 2750 },
  { text: "────────────────────────────────────────", cls: "text-crt-faint", d: 3100 },
];
const BRIEF_LINES = [
  "مأموریت: ایستگاه را ۳۰ روز در برابر فروپاشی نگه دار.",
  "اتصال زمین ناپایدار است؛ پیام‌ها رمزگذاری‌شده می‌رسند.",
  "هر فرمانده‌ای یک خط دارد که از آن رد نمی‌شود. خط تو کجاست؟",
];

export function BootScreen({ onStart }: { onStart: () => void }) {
  const [n, setN] = useState(0);
  const [brief, setBrief] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ts = BOOT_LINES.map((l, i) =>
      setTimeout(() => setN(i + 1), l.d));
    const t1 = setTimeout(() => setBrief(1), 3600);
    const t2 = setTimeout(() => setBrief(2), 4200);
    const t3 = setTimeout(() => setBrief(3), 4800);
    const t4 = setTimeout(() => setReady(true), 5400);
    return () => { ts.forEach(clearTimeout); [t1, t2, t3, t4].forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && ready) onStart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, onStart]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-crt-deep/60 p-4" onClick={() => ready && onStart()}>
      <div className="modal-in w-full max-w-2xl border border-crt-faint/70 bg-crt-deep/95 p-4 shadow-[0_0_60px_rgba(20,120,70,.25)] sm:p-6">
        <div dir="ltr" className="font-display text-[13px] leading-relaxed sm:text-[15px]">
          {BOOT_LINES.slice(0, n).map((l, i) => (
            <div key={i} className={cn("boot-line", l.cls)}>{l.text}</div>
          ))}
          {n > 0 && n < BOOT_LINES.length && <span className="type-caret" />}
        </div>

        {n >= BOOT_LINES.length && (
          <>
            <pre dir="ltr" className="mt-3 font-display text-[11px] leading-[1.05] text-crt-green glow-green sm:text-[15px]">{ASCII_LOGO}</pre>
            <pre dir="ltr" className="mt-1 font-display text-[11px] leading-tight text-crt-cyan/70 sm:text-[13px]">{ASCII_STATION}</pre>

            <div dir="rtl" className="mt-4 space-y-1.5 border-t border-crt-faint/50 pt-3 font-fa text-[12.5px] leading-relaxed text-crt-green/90 sm:text-[13.5px]">
              {BRIEF_LINES.slice(0, brief).map((l, i) => (
                <p key={i} className="boot-line">{l}</p>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <span dir="ltr" className={cn("font-display text-[15px] tracking-[0.2em] text-crt-green", ready ? "" : "opacity-0")}>
                <span className="pulse-critical">▮ PRESS ENTER — شروع فرماندهی</span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onStart(); }}
                disabled={!ready}
                className="btn-term bg-crt-green/10 px-4 py-1.5 font-display text-[16px] tracking-[0.2em] text-crt-green disabled:opacity-30"
              >
                START ▸
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────── مودال تصمیم / Decision modal ─────────── */
function Delta({ label, v }: { label: string; v: number }) {
  if (v === 0) return null;
  return (
    <span className={cn(
      "border px-1 py-px font-display text-[11px] leading-none",
      v > 0 ? "border-crt-green/50 text-crt-green" : "border-crt-red/50 text-crt-red",
    )}>
      {label} {v > 0 ? "+" : ""}{toFa(v)}
    </span>
  );
}

export function ScenarioModal({ s, onChoose }: { s: Scenario; onChoose: (i: number) => void }) {
  const isFinal = s.id === 99;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-[2px]">
      <div className={cn(
        "modal-in w-full max-w-xl border-2 bg-crt-deep/98 shadow-[0_0_80px_rgba(224,123,255,.15)]",
        isFinal ? "border-crt-yellow/70" : "border-crt-magenta/70",
      )}>
        <div className={cn(
          "flex items-center justify-between border-b px-3 py-1.5",
          isFinal ? "border-crt-yellow/40 bg-crt-yellow/10" : "border-crt-magenta/40 bg-crt-magenta/10",
        )}>
          <span dir="rtl" className="font-fa text-[12px] font-bold text-crt-yellow">
            ◈ {isFinal ? "لحظه‌ی سرنوشت — روز سی‌ام" : "تصمیم فرمانده لازم است"}
          </span>
          <span dir="ltr" className="pulse-critical font-display text-[11px] tracking-[0.25em] text-crt-yellow">
            ‖ TIME FROZEN
          </span>
        </div>

        <div className="p-4">
          <h3 dir="rtl" className={cn("font-fa text-lg font-black leading-snug", isFinal ? "text-crt-yellow" : "text-crt-magenta")}>
            {s.title}
          </h3>
          <p dir="rtl" className="mt-2 font-fa text-[13px] leading-relaxed text-crt-green/90">{s.text}</p>

          <div className="mt-4 space-y-2">
            {s.options.map((o, i) => {
              const hasDeltas = o.morale !== 0 || o.order !== 0 || o.survival !== 0;
              return (
                <button
                  key={i}
                  onClick={() => onChoose(i)}
                  className={cn(
                    "group flex w-full items-start gap-2.5 border px-2.5 py-2 text-right transition-all duration-150",
                    "border-crt-faint/60 bg-crt-bg/60 hover:border-crt-green/70 hover:bg-crt-green/10 hover:shadow-[0_0_18px_rgba(69,255,156,.15)]",
                  )}
                >
                  <span className={cn(
                    "mt-px shrink-0 border px-1.5 font-display text-[15px] leading-tight transition-colors",
                    "border-crt-dim text-crt-dim group-hover:border-crt-green group-hover:text-crt-green",
                  )}>
                    {toFa(i + 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span dir="rtl" className="block font-fa text-[12.5px] leading-relaxed text-crt-green/90 group-hover:text-crt-green">
                      {o.label}
                    </span>
                    {hasDeltas && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        <Delta label="روحیه" v={o.morale} />
                        <Delta label="نظم" v={o.order} />
                        <Delta label="بقا" v={o.survival} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <p dir="ltr" className="mt-3 text-center font-display text-[11px] tracking-[0.25em] text-crt-dim">
            PRESS [1] [2] [3] — زمان تا انتخاب شما متوقف است
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────── صفحه‌ی پایان / Ending screen ─────────── */
const END_THEME: Record<Ending["type"], { cls: string; glow: string; border: string; title: string }> = {
  heroic: { cls: "text-crt-green", glow: "glow-green", border: "border-crt-green/60", title: "پایان قهرمانانه" },
  sacrificial: { cls: "text-crt-yellow", glow: "glow-yellow", border: "border-crt-yellow/60", title: "پایان فداکارانه" },
  dark: { cls: "text-crt-red", glow: "glow-red", border: "border-crt-red/60", title: "پایان تاریک" },
  mysterious: { cls: "text-crt-magenta", glow: "glow-magenta", border: "border-crt-magenta/60", title: "پایان مرموز" },
};

export function EndingScreen({ e, onRestart }: { e: Ending; onRestart: () => void }) {
  const t = END_THEME[e.type];
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Enter") onRestart(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onRestart]);

  const [art, ...rest] = e.lines;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-[3px]">
      <div className={cn("modal-in my-4 w-full max-w-2xl border-2 bg-crt-deep/98", t.border)}>
        <div className={cn("border-b px-4 py-2", t.border)}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 dir="rtl" className={cn("font-fa text-xl font-black sm:text-2xl", t.cls, t.glow)}>{t.title}</h2>
            <span dir="ltr" className={cn("font-display text-lg tracking-[0.2em]", t.cls)}>«{e.title}»</span>
          </div>
        </div>

        <div className="crt-scroll max-h-[70vh] overflow-y-auto p-4">
          <pre dir="ltr" className={cn("font-display text-[12px] leading-tight sm:text-[14px]", t.cls, t.glow)}>{art}</pre>
          <div dir="rtl" className="mt-3 space-y-2 border-t border-crt-faint/40 pt-3">
            {rest.map((l, i) => (
              <p key={i} className="boot-line font-fa text-[13px] leading-relaxed text-crt-green/90" style={{ animationDelay: `${i * 0.25}s` }}>
                {l}
              </p>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-px border border-crt-faint/50 bg-crt-faint/30 sm:grid-cols-4">
            {e.stats.map((s, i) => (
              <div key={i} className="bg-crt-deep px-2.5 py-2">
                <div dir="rtl" className="font-fa text-[10px] text-crt-dim">{s.label}</div>
                <div dir="ltr" className={cn("mt-0.5 font-display text-[19px] leading-none", t.cls)}>{s.value}</div>
              </div>
            ))}
          </div>

          <button
            onClick={onRestart}
            className="btn-term mt-4 w-full bg-crt-green/10 px-4 py-2 font-display text-[17px] tracking-[0.25em] text-crt-green"
          >
            ▮ RESTART — مأموریت دوباره (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}
