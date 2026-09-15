/* ============================================================
   AVICENNA-7 — Terminal Sound Synth / سینت‌سایزر صدای ترمینال
   ------------------------------------------------------------
   بوق‌های کوتاه WebAudio برای فرمان‌ها، هشدارها و رویدادها.
   Short WebAudio blips for commands, alarms and events.
   ============================================================ */

import type { SoundType } from "./game/engine";

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** پخش صدای رویداد بر اساس نوع آن */
export function playSound(type: SoundType, enabled: boolean) {
  if (!enabled) return;
  switch (type) {
    case "blip": tone(880, 0.06, "square", 0.03); break;
    case "good": tone(660, 0.09, "sine", 0.05); tone(990, 0.12, "sine", 0.05, 0.09); break;
    case "bad": tone(220, 0.18, "sawtooth", 0.045); break;
    case "alarm":
      tone(520, 0.14, "square", 0.04); tone(390, 0.14, "square", 0.04, 0.16);
      tone(520, 0.14, "square", 0.04, 0.32); break;
    case "msg": tone(1200, 0.05, "sine", 0.04); tone(1500, 0.07, "sine", 0.04, 0.07); break;
    case "mystery":
      tone(300, 0.35, "sine", 0.035); tone(303, 0.35, "sine", 0.035);
      tone(452, 0.4, "sine", 0.03, 0.2); break;
  }
}

/** بازکردن قفل صدا با اولین تعامل کاربر */
export function unlockAudio() { ac(); }
