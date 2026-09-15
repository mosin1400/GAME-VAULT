// ============================================================================
// Scheduler – اجرای زمان‌بندی‌شده (Cron) و Polling Trigger ها
// هر ۶۰ ثانیه جریان‌های فعال بررسی می‌شوند
// ============================================================================
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { executeWorkflow } from "./executor";

const g = globalThis as typeof globalThis & { __ffSchedulerStarted?: boolean; __ffLastRun?: Map<string, number> };
g.__ffLastRun ??= new Map();

/** بررسی تطابق عبارت Cron ۵ بخشی با زمان داده‌شده */
export function cronMatches(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const vals = [date.getMinutes(), date.getHours(), date.getDate(), date.getMonth() + 1, date.getDay()];
  const ranges: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
  return parts.every((p, i) => {
    const [lo, hi] = ranges[i];
    return p.split(",").some((seg) => {
      const [base, stepStr] = seg.split("/");
      const step = stepStr ? Number(stepStr) : 1;
      let from = lo, to = hi;
      if (base !== "*") {
        if (base.includes("-")) { const [a, b] = base.split("-").map(Number); from = a; to = b; }
        else { from = Number(base); to = stepStr ? hi : Number(base); }
      }
      const v = vals[i];
      return v >= from && v <= to && (v - from) % step === 0;
    });
  });
}

/** یک تیک زمان‌بند: بررسی همه جریان‌های فعال */
export async function schedulerTick() {
  const now = new Date();
  const minuteKey = Math.floor(now.getTime() / 60000);
  const active = await db.select().from(workflows).where(eq(workflows.active, true));
  for (const wf of active) {
    for (const node of wf.nodes ?? []) {
      if (node.disabled) continue;
      const key = `${wf.id}:${node.id}`;
      if (node.type === "scheduleTrigger") {
        const cron = String(node.parameters?.cron ?? "*/5 * * * *");
        if (cronMatches(cron, now) && g.__ffLastRun!.get(key) !== minuteKey) {
          g.__ffLastRun!.set(key, minuteKey);
          executeWorkflow(wf, { mode: "schedule", startNodeId: node.id, triggerData: { timestamp: now.toISOString(), cron } }).catch(() => {});
        }
      } else if (node.type === "pollingTrigger" || (node.type.endsWith(".trigger") && node.parameters?.mode === "polling")) {
        const interval = Math.max(1, Number(node.parameters?.intervalMinutes ?? 5));
        if (minuteKey % interval === 0 && g.__ffLastRun!.get(key) !== minuteKey) {
          g.__ffLastRun!.set(key, minuteKey);
          let data: unknown = { polledAt: now.toISOString() };
          if (node.parameters?.url) {
            try { const r = await fetch(String(node.parameters.url)); data = await r.json(); } catch (e) { data = { error: (e as Error).message }; }
          }
          executeWorkflow(wf, { mode: "polling", startNodeId: node.id, triggerData: data }).catch(() => {});
        }
      }
    }
  }
}

/** راه‌اندازی زمان‌بند (idempotent) */
export function startScheduler() {
  if (g.__ffSchedulerStarted) return;
  g.__ffSchedulerStarted = true;
  const align = 60000 - (Date.now() % 60000);
  setTimeout(() => {
    schedulerTick().catch(() => {});
    setInterval(() => schedulerTick().catch(() => {}), 60000);
  }, align);
}
