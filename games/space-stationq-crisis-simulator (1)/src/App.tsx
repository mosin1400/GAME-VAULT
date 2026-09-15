/* ============================================================
   AVICENNA-7 — Terminal Shell / پوسته‌ی ترمینال
   ------------------------------------------------------------
   ترکیب HUD چهاربخشی، خط فرمان، توالی بوت و صفحات پایان.
   Composes the 4-pane HUD, command line, boot and endings.
   ============================================================ */
import { useEffect, useReducer, useRef, useState } from "react";
import { engine } from "./game/engine";
import { playSound, unlockAudio } from "./audio";
import Starfield from "./ui/Starfield";
import { CrewPane, HeaderBar, LogPane, ResourcePane, SystemStrip, TitlePane } from "./ui/Hud";
import { BootScreen, EndingScreen, ScenarioModal } from "./ui/Screens";
import { cn } from "./utils/cn";

const QUICK_CMDS: { label: string; cmd: string }[] = [
  { label: "STATUS", cmd: "status" },
  { label: "CREW", cmd: "crew" },
  { label: "SCAN", cmd: "scan" },
  { label: "MESSAGE", cmd: "message" },
  { label: "SLEEP", cmd: "sleep" },
  { label: "PAUSE", cmd: "pause" },
  { label: "RESUME", cmd: "resume" },
  { label: "HELP", cmd: "help" },
];

export default function App() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const bootRef = useRef(false);

  // اشتراک در تغییرات موتور — هر تیک/رویداد رابط را تازه می‌کند
  useEffect(() => {
    const un = engine.subscribe(force);
    engine.onSound = (t) => playSound(t, engine.soundOn);
    return un;
  }, []);

  // فوکوس همیشگی خط فرمان
  useEffect(() => {
    const focus = () => { if (engine.phase === "playing") inputRef.current?.focus(); };
    window.addEventListener("mousedown", focus);
    focus();
    return () => window.removeEventListener("mousedown", focus);
  }, []);

  const submit = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    engine.handleCommand(cmd);
    setInput("");
  };

  const startGame = () => {
    if (bootRef.current) return;
    bootRef.current = true;
    unlockAudio();
    engine.start();
    playSound("good", true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const alarm = engine.phase === "playing" && engine.resources.values.oxygen < 15;

  return (
    <div dir="ltr" className={cn(
      "crt-flicker fixed inset-0 flex flex-col gap-1.5 overflow-hidden p-2 font-mono sm:p-2.5",
      alarm && "alarm-frame",
    )}>
      <Starfield />
      {/* لایه‌های CRT: اسکن‌لاین، وینیت و باریکه‌ی نور متحرک */}
      <div className="scanlines pointer-events-none fixed inset-0 z-30" />
      <div className="vignette pointer-events-none fixed inset-0 z-30" />
      <div className="beam fixed left-0 right-0 z-30" />

      {engine.phase === "boot" && <BootScreen onStart={startGame} />}
      {engine.phase === "ending" && engine.ending && (
        <EndingScreen e={engine.ending} onRestart={() => engine.restart()} />
      )}
      {engine.scenarioActive && engine.activeScenario && engine.phase === "playing" && (
        <ScenarioModal s={engine.activeScenario} onChoose={(i) => engine.chooseOption(i)} />
      )}

      <HeaderBar g={engine} onToggleSound={() => { engine.soundOn = !engine.soundOn; engine.log("sys", engine.soundOn ? "صدا روشن شد." : "صدا خاموش شد."); }} />

      <main className={cn(
        "grid min-h-0 flex-1 grid-cols-[minmax(280px,42%)_minmax(0,1fr)] grid-rows-[minmax(0,47%)_minmax(0,53%)] gap-1.5",
        "max-md:grid-cols-1 max-md:grid-rows-none max-md:auto-rows-[240px] max-md:overflow-y-auto max-md:crt-scroll",
      )}>
        <TitlePane g={engine} />
        <LogPane g={engine} />
        <ResourcePane g={engine} />
        <CrewPane g={engine} />
      </main>

      <SystemStrip g={engine} />

      {/* نوار فرمان‌های سریع */}
      <div dir="ltr" className="hidden flex-wrap gap-1 sm:flex">
        {QUICK_CMDS.map((q) => (
          <button
            key={q.cmd + q.label}
            onClick={() => submit(q.cmd)}
            className="btn-term px-2 py-[3px] font-display text-[12px] leading-none tracking-[0.15em] text-crt-green/75"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* خط فرمان */}
      <div
        className="relative flex items-center gap-2 border border-crt-green/40 bg-crt-deep/90 px-2.5 py-2 shadow-[0_0_24px_rgba(69,255,156,.07)]"
        onClick={() => inputRef.current?.focus()}
      >
        <span className="font-display text-[19px] leading-none text-crt-green glow-green">&gt;</span>
        <span dir="auto" className="flex min-w-0 flex-1 items-center gap-0 font-fa text-[13.5px] text-crt-green">
          <span className="whitespace-pre-wrap break-all">{input}</span>
          <span className="cursor-block" />
        </span>
        <span dir="ltr" className="hidden shrink-0 font-display text-[11px] tracking-[0.2em] text-crt-faint md:inline">
          {engine.phase === "playing" ? (engine.scenarioActive ? "AWAITING DECISION [1-3]" : engine.paused ? "PAUSED — resume" : "READY — type help") : "STANDBY"}
        </span>
        <input
          ref={inputRef}
          className="ghost-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (engine.phase === "playing") submit(input);
              // در صفحات بوت/پایان، Enter توسط خود آن صفحات دریافت می‌شود
            }
          }}
          autoFocus
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
        />
      </div>
    </div>
  );
}
