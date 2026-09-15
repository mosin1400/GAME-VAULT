/**
 * ============================================================
 *  EthicsSystem — سیستم تصمیم‌گیری اخلاقی
 * ============================================================
 *  ۱۰ سناریو در روزهای ۲، ۵، ۸، ... ۲۹ ظاهر می‌شوند.
 *  تا زمانی که فرمانده انتخاب نکند، بازی متوقف است (زمان جلو نمی‌رود).
 *  هر انتخاب روی روحیه، نظم و شانس بقا اثر می‌گذارد.
 */
import { CONFIG } from './types';
import type { EthicsContext, EthicsOption, EthicsScenario } from './types';
import { SCENARIOS } from './data/scenarios';

export class EthicsSystem {
  private queue: EthicsScenario[] = [...SCENARIOS];
  pending: EthicsScenario | null = null;
  history: { id: number; choice: number }[] = [];
  flags = new Set<string>(); // پرچم‌های داستانی: cruel, selfless, answered_signal, follow_signal

  /** روزهایی که سناریو دارند: 2,5,8,...,29 */
  static isScenarioDay(day: number) {
    return day >= CONFIG.ETHICS_FIRST_DAY && (day - CONFIG.ETHICS_FIRST_DAY) % CONFIG.ETHICS_EVERY_DAYS === 0;
  }

  /** سناریوی بعدی را در صورت وجود فعال می‌کند */
  trigger(): EthicsScenario | null {
    if (this.pending || !this.queue.length) return null;
    this.pending = this.queue.shift()!;
    return this.pending;
  }

  /** سناریوی سفارشی (مثلاً سناریوی پایان مرموز) */
  triggerCustom(s: EthicsScenario) {
    if (this.pending) this.queue.unshift(s);
    else this.pending = s;
  }

  /** اعمال انتخاب فرمانده. برمی‌گرداند گزینه‌ی انتخاب‌شده */
  choose(index: number, ctx: EthicsContext): EthicsOption | null {
    if (!this.pending || index < 0 || index > 2) return null;
    const opt = this.pending.options[index];
    this.history.push({ id: this.pending.id, choice: index });
    opt.extra?.(ctx);
    this.pending = null;
    return opt;
  }

  /** شمارش تصمیم‌های «سخت‌گیرانه» برای تعیین پایان */
  get cruelty() {
    return this.history.filter((h) => h.choice === 2).length;
  }
  get compassion() {
    return this.history.filter((h) => h.choice === 0).length;
  }
}
