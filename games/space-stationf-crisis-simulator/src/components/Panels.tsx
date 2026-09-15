/**
 * Panels.tsx — چهار پنل اصلی رابط ترمینالی
 *  HeaderPanel   : بالا-چپ  (عنوان، روز، ساعت، خدمه‌ی زنده، نظم/بقا)
 *  ResourcePanel : پایین-چپ (۵ نوار پیشرفت رنگی █░)
 *  LogPanel      : بالا-راست (۱۰ رویداد آخر با زمان)
 *  CrewPanel     : پایین-راست (لیست خدمه با تخصص و وضعیت روحی)
 */
import type { ReactNode } from 'react';
import type { GameSnapshot } from '../game/types';
import { CONFIG, RESOURCE_KEYS } from '../game/types';
import { ResourceSystem } from '../game/ResourceSystem';
import { CrewSystem } from '../game/CrewSystem';
import { ansi } from './ansi';

/** قاب ASCII با عنوان — شبیه ┌─ TITLE ─┐ */
export function Panel({ title, children, className = '', accent = 'border-[#1f7a3a]' }: { title: string; children: ReactNode; className?: string; accent?: string }) {
  return (
    <div className={`relative border ${accent} p-2 pt-3 min-h-0 overflow-hidden ${className}`}>
      <span className="absolute -top-2.5 left-2 bg-black px-1 text-[11px] tracking-widest text-[#4ade80]">┤ {title} ├</span>
      {children}
    </div>
  );
}

// ---------- Header / بالا-چپ ----------
export function HeaderPanel({ s, clock }: { s: GameSnapshot; clock: string }) {
  const alive = s.crew.filter((c) => c.status !== 'dead').length;
  const dayPct = Math.round((s.time / (CONFIG.TOTAL_DAYS * CONFIG.DAY_SECONDS)) * 100);
  return (
    <Panel title="KEPLER-7 COMMAND" className="flex flex-col justify-between">
      <pre className="text-[#22d3ee] leading-tight text-[11px] sm:text-xs">{`  _  _____ ___ _    ___ ___   ____
 | |/ / __| _ \\ |  | __| _ \\ |__  |
 | ' <| _||  _/ |__| _||   /   / /
 |_|\\_\\___|_| |____|___|_|_\\  /_/  STATION`}</pre>
      <div className="mt-1 grid grid-cols-2 gap-x-3 text-xs">
        <div>
          <span className="text-[#6b7280]">DAY </span>
          <span className="text-[#facc15] font-bold">
            {String(s.day).padStart(2, '0')}/{CONFIG.TOTAL_DAYS}
          </span>
          <span className="text-[#6b7280]"> {clock}</span>
        </div>
        <div>
          <span className="text-[#6b7280]">CREW </span>
          <span className={alive === 12 ? 'text-[#4ade80]' : alive >= 8 ? 'text-[#facc15]' : 'text-[#f87171]'}>{alive}/12 alive</span>
        </div>
        <div>
          <span className="text-[#6b7280]">ORDER </span>
          <span className={ansi(ResourceSystem.color(s.order))}>{Math.round(s.order)}</span>
          <span className="text-[#6b7280]"> SURV </span>
          <span className={ansi(ResourceSystem.color(s.survival))}>{Math.round(s.survival)}</span>
        </div>
        <div>
          <span className="text-[#6b7280]">KEYS </span>
          <span className="text-[#60a5fa]">{s.keys}</span>
          <span className="text-[#6b7280]"> FRAG </span>
          <span className="text-[#e879f9]">
            {s.fragments}/{CONFIG.MYSTERY_FRAGMENTS_NEEDED}
          </span>
        </div>
      </div>
      <div className="mt-1 text-[10px] text-[#6b7280]">
        MISSION {ResourceSystem.bar(dayPct, 28)} {dayPct}%
        {s.pendingScenario && <span className="ml-2 text-[#facc15] animate-pulse">■ DECISION PENDING — TIME FROZEN</span>}
        {s.expedition && <span className="ml-2 text-[#e879f9]">■ SHUTTLE AWAY {s.expedition.endsAt - s.time}s</span>}
        {s.objectAvailable && !s.expedition && <span className="ml-2 text-[#e879f9]">■ OBJECT IN RANGE</span>}
      </div>
    </Panel>
  );
}

// ---------- Resources / پایین-چپ ----------
export function ResourcePanel({ s }: { s: GameSnapshot }) {
  const brokenSystems = s.systems.filter((x) => x.broken);
  return (
    <Panel title="RESOURCES">
      <div className="space-y-0.5 text-xs">
        {RESOURCE_KEYS.map((k) => {
          const v = s.resources[k];
          const c = ResourceSystem.color(v);
          return (
            <div key={k} className={`flex items-center gap-2 ${ansi(c)} ${v < 15 ? 'animate-pulse' : ''}`}>
              <span className="w-14 text-[#e5e7eb]">{k.toUpperCase()}</span>
              <span className="tracking-tight">{ResourceSystem.bar(v, 24)}</span>
              <span className="w-9 text-right">{Math.round(v)}%</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 border-t border-[#1f7a3a]/50 pt-1 text-[11px]">
        <span className="text-[#6b7280]">SYSTEMS </span>
        {s.systems.map((x) => (
          <span key={x.key} className={`mr-2 ${x.broken ? 'text-[#f87171]' : 'text-[#4ade80]'}`}>
            {x.broken ? '✖' : '●'} {x.key}
            {x.broken && x.repairCrew.length > 0 && <span className="text-[#facc15]"> {Math.round((x.repairProgress / CONFIG.REPAIR_WORK_UNITS) * 100)}%</span>}
          </span>
        ))}
        <span className="text-[#6b7280]"> │ rations </span>
        <span className="text-[#e5e7eb]">{s.rations}</span>
        {brokenSystems.length > 0 && <div className="text-[#f87171] mt-0.5">⚠ {brokenSystems.length} system(s) down — type: repair &lt;system&gt;</div>}
      </div>
    </Panel>
  );
}

// ---------- Event log / بالا-راست ----------
export function LogPanel({ s }: { s: GameSnapshot }) {
  return (
    <Panel title="EVENT LOG">
      <div className="text-[11px] leading-snug h-full overflow-hidden flex flex-col justify-end">
        {s.log.map((l, i) => (
          <div key={i} className={`truncate ${ansi(l.color)}`}>
            <span className="text-[#6b7280]">[{l.time}]</span> {l.text}
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ---------- Crew / پایین-راست ----------
const MOOD_COLOR = { optimistic: 'text-[#4ade80]', worried: 'text-[#facc15]', nervous: 'text-[#fb923c]', depressed: 'text-[#f87171]' } as const;
const MOOD_ICON = { optimistic: '☺', worried: '☹', nervous: '≈', depressed: '✝' } as const;

export function CrewPanel({ s }: { s: GameSnapshot }) {
  return (
    <Panel title="CREW MANIFEST">
      <div className="grid grid-cols-2 gap-x-3 text-[11px] leading-snug">
        {s.crew.map((m) => {
          const mood = CrewSystem.mood(m);
          const dead = m.status === 'dead';
          return (
            <div key={m.id} className={`flex items-center gap-1 ${dead ? 'text-[#4b5563] line-through' : 'text-[#e5e7eb]'}`}>
              <span className={dead ? '' : MOOD_COLOR[mood]}>{dead ? '✖' : MOOD_ICON[mood]}</span>
              <span className="w-[68px] truncate">{m.name}</span>
              <span className="w-[62px] text-[#6b7280] truncate">{m.role.slice(0, 3)}→{m.task.slice(0, 4)}</span>
              {!dead ? (
                <>
                  <span className={`${MOOD_COLOR[mood]} w-[64px] truncate`}>{mood}</span>
                  <span className={m.status === 'active' ? 'text-[#6b7280]' : 'text-[#facc15]'}>
                    {m.status === 'repairing' ? '🔧' : m.status === 'away' ? '🚀' : m.status === 'injured' ? '✚' : `${Math.round(m.morale)}`}
                  </span>
                </>
              ) : (
                <span className="truncate">{m.deathCause}</span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
