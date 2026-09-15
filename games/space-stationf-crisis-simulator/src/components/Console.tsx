/**
 * Console.tsx — خروجی دستورات + خط فرمان با پرامپت «>»
 *  - اسکرول خودکار به پایین
 *  - تاریخچه‌ی دستورات با کلیدهای ↑ ↓
 *  - پیشنهاد سریع دستورات زیر خط فرمان
 */
import { useEffect, useRef, useState } from 'react';
import type { ConsoleLine, GameSnapshot } from '../game/types';
import { ansi } from './ansi';

export function ConsoleOutput({ lines }: { lines: ConsoleLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines.length]);
  return (
    <div ref={ref} className="flex-1 min-h-0 overflow-y-auto px-2 py-1 text-xs leading-snug font-mono terminal-scroll">
      {lines.map((l, i) => (
        <pre key={i} className={`whitespace-pre-wrap break-words ${ansi(l.color)}`}>
          {l.text || ' '}
        </pre>
      ))}
    </div>
  );
}

export function CommandLine({ s, onSubmit }: { s: GameSnapshot; onSubmit: (cmd: string) => void }) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // فوکوس خودکار با کلیک در هر جای صفحه
  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    focus();
    window.addEventListener('click', focus);
    return () => window.removeEventListener('click', focus);
  }, []);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
    setHistory((h) => [v, ...h].slice(0, 50));
    setHIdx(-1);
    setValue('');
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit();
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const i = Math.min(history.length - 1, hIdx + 1);
      setHIdx(i);
      setValue(history[i] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const i = Math.max(-1, hIdx - 1);
      setHIdx(i);
      setValue(i === -1 ? '' : history[i]);
    }
  };

  const hints =
    s.phase === 'intro'
      ? ['start']
      : s.phase === 'ended'
        ? ['restart']
        : s.pendingScenario
          ? ['1', '2', '3']
          : ['status', 'crew', 'repair', 'explore 3', 'message', 'sleep', 'help'];

  return (
    <div className="border-t border-[#1f7a3a] px-2 py-1 bg-black">
      <div className="flex items-center gap-2 text-sm font-mono">
        <span className={s.pendingScenario ? 'text-[#facc15]' : 'text-[#4ade80]'}>{s.pendingScenario ? '?' : s.phase === 'ended' ? '#' : '>'}</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent outline-none text-[#e5e7eb] caret-[#4ade80] font-mono"
          placeholder={s.phase === 'intro' ? 'press ENTER or type start' : s.pendingScenario ? 'choose 1, 2 or 3' : 'enter command...'}
        />
        <span className="w-2 h-4 bg-[#4ade80] animate-pulse" />
      </div>
      <div className="text-[10px] text-[#6b7280] mt-0.5">
        {hints.map((h) => (
          <button key={h} onClick={(e) => { e.stopPropagation(); onSubmit(h); }} className="mr-2 hover:text-[#4ade80] underline-offset-2 hover:underline">
            {h}
          </button>
        ))}
        <span className="float-right">↑↓ history · click a hint to run it</span>
      </div>
    </div>
  );
}
