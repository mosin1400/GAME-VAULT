/* ============================================================
   HUD — چهار پنل اصلی ترمینال + نوار سیستم‌ها + سربرگ
   Four terminal panes, systems strip and header bar.
   ============================================================ */
import { useEffect, useRef } from "react";
import type { GameEngine } from "../game/engine";
import { DUTY_FA, MOOD_FA } from "./labels";
import type { LogEntry, ResourceKey } from "../game/types";
import { MYSTERY_ARTIFACTS } from "../game/constants";
import { cn } from "../utils/cn";

/** تبدیل ارقام لاتین به فارسی */
export const toFa = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

export const SEV_CLASS: Record<LogEntry["severity"], string> = {
  info: "text-crt-green",
  sys: "text-crt-dim",
  good: "text-crt-cyan",
  warn: "text-crt-yellow",
  bad: "text-crt-red",
  story: "text-crt-magenta",
};

/* ─────────── قاب پنل / Pane frame ─────────── */
export function Pane({ title, en, children, className, critical }: {
  title: string; en: string; children: React.ReactNode; className?: string; critical?: boolean;
}) {
  return (
    <section className={cn(
      "relative flex min-h-0 flex-col border border-crt-faint/60 bg-crt-deep/70",
      critical && "border-crt-red/70",
      className,
    )}>
      <span className="absolute -top-px -right-px h-2 w-2 border-t border-r border-crt-green/60" />
      <span className="absolute -top-px -left-px h-2 w-2 border-t border-l border-crt-green/60" />
      <span className="absolute -bottom-px -right-px h-2 w-2 border-b border-r border-crt-green/60" />
      <span className="absolute -bottom-px -left-px h-2 w-2 border-b border-l border-crt-green/60" />
      <header className="flex items-baseline justify-between gap-2 border-b border-crt-faint/50 bg-crt-bg/80 px-2.5 py-1">
        <h2 className="font-fa text-[11px] font-bold tracking-wide text-crt-green/90">{title}</h2>
        <span className="font-display text-[13px] leading-none tracking-[0.18em] text-crt-dim">{en}</span>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

/* ─────────── بالا-چپ: عنوان و روز / Title pane ─────────── */
export function TitlePane({ g }: { g: GameEngine }) {
  const dayPct = ((g.tick % 120) / 120) * 100;
  const alive = g.crewMgr.alive().length;
  const total = g.crewMgr.crew.length;
  return (
    <Pane title="ایستگاه مداری هفت" en="AVICENNA-7" className="overflow-hidden">
      <div className="flex h-full flex-col gap-2 overflow-hidden p-2.5">
        <pre dir="ltr" className="font-display text-[13px] leading-[1.05] text-crt-green glow-green select-none sm:text-[15px]">
{String.raw`   _    ___ ___ ___ _  _ ___ _  _   _  __  __
  /_\  |_ _/ __|_ _| \| | __| \| | /_\|  \/  |
 / _ \  | || (__ | || .  | _|| .  |/ _ \ |\/| |
/_/ \_\|___\___|___|_|\_|___|_|\_/_/ \_\_|  |_|
        ORBITAL CRISIS COMMAND · v3.7`}
        </pre>

        <div dir="ltr" className="flex items-end gap-3">
          <div className="font-display leading-none">
            <div className="text-[11px] tracking-[0.3em] text-crt-dim">MISSION DAY</div>
            <div className={cn("text-5xl glow-green", g.day > 26 ? "text-crt-yellow glow-yellow" : "text-crt-green")}>
              {String(g.day).padStart(2, "0")}<span className="text-2xl text-crt-dim">/30</span>
            </div>
          </div>
          <div dir="ltr" className="mb-1 flex-1">
            <div className="flex justify-between font-display text-[11px] tracking-widest text-crt-dim">
              <span>{g.timeStr} {g.isDaytime ? "☀ DAY" : "☾ NIGHT"}</span>
              <span>{Math.round(dayPct)}%</span>
            </div>
            <div className="mt-0.5 h-1.5 border border-crt-faint/70 bg-crt-bg p-px">
              <div className="bar-live h-full bg-crt-green/80" style={{ width: `${dayPct}%` }} />
            </div>
          </div>
        </div>

        <div dir="ltr" className="grid grid-cols-2 gap-x-3 gap-y-1 font-display text-[15px] leading-tight">
          <div className="flex items-center justify-between border-b border-crt-faint/40 pb-0.5">
            <span className="tracking-widest text-crt-dim">CREW ALIVE</span>
            <span className={cn("glow-green", alive < 6 ? "text-crt-red glow-red" : "text-crt-green")}>{alive}/{total}</span>
          </div>
          <div className="flex items-center justify-between border-b border-crt-faint/40 pb-0.5">
            <span className="tracking-widest text-crt-dim">MORALE</span>
            <span className="text-crt-cyan glow-cyan">{Math.round(g.crewMgr.avgMood())}</span>
          </div>
          <div className="flex items-center justify-between border-b border-crt-faint/40 pb-0.5">
            <span className="tracking-widest text-crt-dim">ORDER</span>
            <span className={cn(g.order < 25 ? "text-crt-red glow-red" : "text-crt-yellow glow-yellow")}>{Math.round(g.order)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-crt-faint/40 pb-0.5">
            <span className="tracking-widest text-crt-dim">SURVIVAL</span>
            <span className="text-crt-green glow-green">{g.survival()}%</span>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 font-fa text-[10.5px] text-crt-dim">
          <span>جیره: <b className="text-crt-yellow">{({ low: "کم", medium: "متوسط", high: "زیاد" })[g.ration]}</b></span>
          <span dir="ltr" className="text-crt-cyan">[KEYS ×{g.expSys.keys}]</span>
          <span dir="ltr" className={cn(g.expSys.artifacts >= MYSTERY_ARTIFACTS ? "text-crt-magenta glow-magenta" : "text-crt-dim")}>
            [ARTIFACTS {g.expSys.artifacts}/{MYSTERY_ARTIFACTS}]
          </span>
          {g.expSys.shuttleDamaged && <span className="text-crt-red">سفینه: آسیب‌دیده</span>}
          {g.expSys.mission && (
            <span dir="ltr" className="pulse-critical font-display tracking-widest text-crt-magenta">● TEAM IN FLIGHT</span>
          )}
          {g.expSys.activeObject() && (
            <span className="text-crt-magenta">◈ شیء ناشناخته در محدوده — scan</span>
          )}
        </div>
      </div>
    </Pane>
  );
}

/* ─────────── پایین-چپ: نوار منابع / Resource bars ─────────── */
const RES_META: { key: ResourceKey; en: string; fa: string; cls: string; glow: string }[] = [
  { key: "oxygen", en: "O2 ", fa: "اکسیژن", cls: "text-crt-cyan", glow: "glow-cyan" },
  { key: "energy", en: "PWR", fa: "انرژی", cls: "text-crt-yellow", glow: "glow-yellow" },
  { key: "water", en: "H2O", fa: "آب", cls: "text-crt-blue", glow: "glow-blue" },
  { key: "food", en: "FD ", fa: "غذا", cls: "text-crt-green", glow: "glow-green" },
  { key: "fuel", en: "FUE", fa: "سوخت", cls: "text-crt-magenta", glow: "glow-magenta" },
];
const CELLS = 18;

export function ResourcePane({ g }: { g: GameEngine }) {
  return (
    <Pane title="منابع حیاتی" en="LIFE SUPPORT">
      <div className="flex h-full flex-col justify-center gap-[7px] overflow-hidden px-2.5 py-2">
        {RES_META.map((m) => {
          const v = g.resources.values[m.key];
          const d = g.resources.deltas[m.key];
          const filled = Math.round((v / 100) * CELLS);
          const critical = v < 20;
          return (
            <div key={m.key} dir="ltr" className="flex items-center gap-1.5 font-display text-[15px] leading-none sm:text-[17px]">
              <span className={cn("w-8", m.cls, critical && "pulse-critical")}>{m.en}</span>
              <span className={cn("tracking-tight", critical ? "text-crt-red glow-red pulse-critical" : cn(m.cls, m.glow))}>
                {"█".repeat(filled)}<span className="text-crt-faint">{"░".repeat(CELLS - filled)}</span>
              </span>
              <span className={cn("w-9 text-right", critical ? "text-crt-red" : "text-crt-green/80")}>{Math.round(v)}</span>
              <span className={cn("w-4 text-[13px]", d > 0.05 ? "text-crt-green" : d < -0.05 ? "text-crt-red" : "text-crt-faint")}>
                {d > 0.05 ? "▲" : d < -0.05 ? "▼" : "·"}
              </span>
              <span className="hidden font-fa text-[10px] text-crt-dim sm:inline">{m.fa}</span>
            </div>
          );
        })}
        <div dir="ltr" className="mt-1 border-t border-crt-faint/40 pt-1 font-display text-[12px] tracking-widest text-crt-dim">
          REGEN {g.systems.isOnline("oxygen") ? <span className="text-crt-green">O2:ON</span> : <span className="text-crt-red pulse-critical">O2:OFF</span>}
          {" · "}
          {g.systems.isOnline("electrical") ? <span className="text-crt-green">PWR:ON</span> : <span className="text-crt-red pulse-critical">PWR:OFF</span>}
          {" · "}
          SOLAR {g.isDaytime ? <span className="text-crt-yellow">+MAX</span> : <span className="text-crt-dim">+MIN</span>}
        </div>
      </div>
    </Pane>
  );
}

/* ─────────── بالا-راست: لاگ رویدادها / Event log ─────────── */
export function LogPane({ g }: { g: GameEngine }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [g.logs.length]);

  const visible = g.logs.slice(-34);
  return (
    <Pane title="لاگ رویدادها" en="EVENT LOG" critical={g.resources.values.oxygen < 15}>
      <div ref={boxRef} className="crt-scroll h-full overflow-y-auto px-2 py-1.5" dir="rtl">
        {visible.map((l) => (
          <div key={l.id} className="log-in flex gap-2 py-[1px] font-fa text-[11.5px] leading-[1.55]">
            <span dir="ltr" className="shrink-0 font-display text-[12px] leading-[1.45] text-crt-faint">
              [{String(l.day).padStart(2, "0")}·{l.time}]
            </span>
            <span className={cn("min-w-0", SEV_CLASS[l.severity])}>{l.text}</span>
          </div>
        ))}
        {g.logs.length === 0 && (
          <div className="py-2 text-center font-fa text-[11px] text-crt-dim">— لاگ خالی است —</div>
        )}
      </div>
    </Pane>
  );
}

/* ─────────── پایین-راست: فهرست خدمه / Crew roster ─────────── */
const MOOD_CLS: Record<string, string> = {
  "خوش‌بین": "text-crt-green", "نگران": "text-crt-yellow",
  "عصبی": "text-crt-orange", "افسرده": "text-crt-red",
};
const STATUS_GLYPH: Record<string, string> = {
  idle: "▣", repairing: "⚒", exploring: "⇗", injured: "✚", dead: "✝",
};

export function CrewPane({ g }: { g: GameEngine }) {
  const crew = [...g.crewMgr.crew].sort((a, b) =>
    Number(a.status === "dead") - Number(b.status === "dead") || a.id - b.id);
  return (
    <Pane title={`خدمه — ${toFa(g.crewMgr.alive().length)} زنده`} en="CREW MANIFEST">
      <div className="crt-scroll h-full overflow-y-auto px-2 py-1" dir="ltr">
        <div className="grid grid-cols-[3ch_minmax(0,1.35fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_7ch_minmax(0,0.75fr)] gap-x-1.5 border-b border-crt-faint/50 pb-0.5 font-display text-[11px] tracking-widest text-crt-dim">
          <span>ID</span><span>NAME</span><span>ROLE</span><span>DUTY</span><span>MOOD</span><span>STATE</span>
        </div>
        {crew.map((c) => {
          const dead = c.status === "dead";
          const st = MOOD_FA(c.mood);
          const moodCells = Math.round(c.mood / 100 * 5);
          return (
            <div key={c.id} className={cn(
              "grid grid-cols-[3ch_minmax(0,1.35fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_7ch_minmax(0,0.75fr)] items-center gap-x-1.5 border-b border-crt-faint/20 py-[2.5px] font-fa text-[10.5px] leading-tight",
              dead && "opacity-35 line-through decoration-crt-red/60",
            )}>
              <span className="font-display text-[12px] text-crt-dim">{String(c.id).padStart(2, "0")}</span>
              <span dir="rtl" className={cn("truncate text-right", dead ? "text-crt-dim" : "text-crt-green/90")}>{c.name}</span>
              <span dir="rtl" className="truncate text-right text-crt-dim">{c.role}</span>
              <span dir="rtl" className="truncate text-right text-crt-cyan/90">{dead ? "—" : DUTY_FA[c.duty] ?? c.duty}</span>
              <span className={cn("font-display text-[12px]", MOOD_CLS[st.fa])}>
                {"▰".repeat(moodCells)}<span className="text-crt-faint">{"▱".repeat(5 - moodCells)}</span>
              </span>
              <span className={cn("truncate", dead ? "text-crt-red" : "text-crt-dim")}>
                {STATUS_GLYPH[c.status]} <span dir="rtl" className={MOOD_CLS[st.fa]}>{dead ? "مرده" : st.fa}</span>
              </span>
            </div>
          );
        })}
      </div>
    </Pane>
  );
}

/* ─────────── نوار سیستم‌های ایستگاه / Systems strip ─────────── */
export function SystemStrip({ g }: { g: GameEngine }) {
  return (
    <div dir="ltr" className="flex items-stretch gap-1.5 overflow-x-auto">
      {g.systems.systems.map((s) => {
        const repairing = s.state === "repairing";
        const down = s.state === "damaged";
        return (
          <div key={s.key} className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 border px-2 py-[3px] font-display text-[12px] leading-none tracking-wider sm:text-[13px]",
            down ? "border-crt-red/60 bg-crt-red/10 text-crt-red" :
            repairing ? "border-crt-yellow/60 bg-crt-yellow/5 text-crt-yellow" :
            "border-crt-faint/60 bg-crt-deep/70 text-crt-green/90",
          )}>
            <span className={cn("text-[10px]", down ? "pulse-critical" : "")}>
              {down ? "✖" : repairing ? "⚒" : "●"}
            </span>
            <span className="truncate">{s.en}</span>
            {repairing ? (
              <span className="ml-auto flex items-center gap-1">
                <span className="hidden sm:inline">
                  {"█".repeat(Math.round(s.repairProgress * 5))}
                  <span className="text-crt-faint">{"░".repeat(5 - Math.round(s.repairProgress * 5))}</span>
                </span>
                <span>{Math.round(s.repairProgress * 100)}%</span>
              </span>
            ) : down ? (
              <span className="ml-auto text-[10px] tracking-widest text-crt-red/80">DOWN</span>
            ) : (
              <span className="ml-auto text-[10px] tracking-widest text-crt-dim">OK</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────── سربرگ / Header bar ─────────── */
export function HeaderBar({ g, onToggleSound }: { g: GameEngine; onToggleSound: () => void }) {
  const frozen = g.scenarioActive || g.paused;
  return (
    <div dir="ltr" className="flex items-center gap-3 border border-crt-faint/60 bg-crt-deep/80 px-2.5 py-1">
      <span className="font-display text-[15px] tracking-[0.22em] text-crt-green glow-green">AVICENNA-7</span>
      <span className="hidden font-display text-[12px] tracking-[0.3em] text-crt-dim sm:inline">ORBITAL CRISIS COMMAND</span>
      <span className="ml-auto flex items-center gap-2.5">
        {frozen && (
          <span className="pulse-critical border border-crt-yellow/70 px-1.5 py-0.5 font-display text-[11px] tracking-[0.25em] text-crt-yellow">
            ‖ TIME FROZEN
          </span>
        )}
        <span dir="rtl" className="font-fa text-[10.5px] text-crt-dim">
          روز <b className="font-display text-[14px] text-crt-green">{toFa(g.day)}</b> — <span className="font-display">{g.timeStr}</span>
        </span>
        <button
          onClick={onToggleSound}
          className="btn-term px-1.5 py-0.5 font-display text-[11px] tracking-widest text-crt-green/80"
          title="روشن/خاموش صدا"
        >
          SND:{g.soundOn ? "ON" : "OFF"}
        </button>
      </span>
    </div>
  );
}
