/**
 * App.tsx — ورودی برنامه: اتصال موتور بازی به رابط ترمینالی
 *  چیدمان:
 *   ┌───────────────┬───────────────┐
 *   │ HEADER        │ EVENT LOG     │   بالا-چپ / بالا-راست
 *   ├───────────────┼───────────────┤
 *   │ RESOURCES     │ CREW          │   پایین-چپ / پایین-راست
 *   ├───────────────┴───────────────┤
 *   │ CONSOLE OUTPUT (scroll)       │
 *   ├───────────────────────────────┤
 *   │ > command line                │
 *   └───────────────────────────────┘
 */
import { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/GameEngine';
import type { GameSnapshot } from './game/types';
import { HeaderPanel, ResourcePanel, LogPanel, CrewPanel } from './components/Panels';
import { ConsoleOutput, CommandLine } from './components/Console';

const INTRO_ART = `
   ██╗  ██╗███████╗██████╗ ██╗     ███████╗██████╗       ███████╗
   ██║ ██╔╝██╔════╝██╔══██╗██║     ██╔════╝██╔══██╗      ╚════██║
   █████╔╝ █████╗  ██████╔╝██║     █████╗  ██████╔╝█████╗    ██╔╝
   ██╔═██╗ ██╔══╝  ██╔═══╝ ██║     ██╔══╝  ██╔══██╗╚════╝   ██╔╝
   ██║  ██╗███████╗██║     ███████╗███████╗██║  ██║         ██║
   ╚═╝  ╚═╝╚══════╝╚═╝     ╚══════╝╚══════╝╚═╝  ╚═╝         ╚═╝
          O R B I T A L   C R I S I S   C O M M A N D E R`;

export default function App() {
  // موتور بازی یک‌بار ساخته می‌شود و بین رندرها زنده می‌ماند
  const engineRef = useRef<GameEngine | null>(null);
  if (!engineRef.current) engineRef.current = new GameEngine();
  const engine = engineRef.current;

  const [snap, setSnap] = useState<GameSnapshot>(() => engine.snapshot());
  const [clock, setClock] = useState(engine.clock());

  useEffect(() => {
    const unsub = engine.subscribe(() => {
      setSnap(engine.snapshot());
      setClock(engine.clock());
    });
    // ساعت بازی: هر ثانیه‌ی واقعی یک تیک
    const id = setInterval(() => engine.tick(), 1000);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, [engine]);

  const run = (cmd: string) => engine.execute(cmd);

  return (
    <div className="h-screen w-screen bg-black text-[#e5e7eb] font-mono flex flex-col crt overflow-hidden select-text">
      {snap.phase === 'intro' ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <pre className="text-[#22d3ee] text-[9px] sm:text-xs leading-tight">{INTRO_ART}</pre>
          <div className="mt-6 max-w-2xl text-xs sm:text-sm text-[#9ca3af] leading-relaxed text-center space-y-2">
            <p>Year 2091. Station Kepler-7, low lunar orbit. Twelve crew. Thirty days until rescue.</p>
            <p>
              You are the <span className="text-[#4ade80]">Commander</span>. Manage oxygen, energy, water, food and fuel. Repair what breaks. Decide who eats, who
              works, who goes outside — and who comes back.
            </p>
            <p className="text-[#6b7280]">1 day = 2 real minutes · resources drain every 10s · failures ~20%/min · decisions freeze time</p>
          </div>
          <div className="mt-6 text-[#facc15] animate-pulse text-sm">▶ press ENTER to take command</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 pt-4 shrink-0">
          <HeaderPanel s={snap} clock={clock} />
          <LogPanel s={snap} />
          <ResourcePanel s={snap} />
          <CrewPanel s={snap} />
        </div>
      )}

      {snap.phase !== 'intro' && (
        <div className="flex-1 min-h-0 flex flex-col mx-3 mb-0 border border-[#1f7a3a] relative">
          <span className="absolute -top-2.5 left-2 bg-black px-1 text-[11px] tracking-widest text-[#4ade80]">┤ CONSOLE ├</span>
          <ConsoleOutput lines={snap.console} />
        </div>
      )}
      <div className="mx-3 mb-3">
        <CommandLine s={snap} onSubmit={run} />
      </div>
    </div>
  );
}
