/**
 * ============================================================
 *  EndingSystem — تعیین یکی از ۴ پایان‌بندی
 * ============================================================
 *  قواعد (به ترتیب اولویت):
 *   1. mystery  : قطعات کافی جمع شده و فرمانده «دنبال سیگنال» را انتخاب کرده
 *   2. dark     : شورش رخ داده / نظم < ۳۰ / همه مرده‌اند / ایستگاه سقوط کرده
 *   3. heroic   : همه‌ی ۱۲ خدمه زنده، شانس بقا ≥ ۵۰، تصمیم‌های بی‌رحمانه ≤ ۲
 *   4. sacrifice: در غیر این صورت — خدمه نجات می‌یابند، فرمانده می‌ماند
 */
import { CONFIG } from './types';
import type { EndingKey } from './types';
import { ENDINGS } from './data/endings';

export interface EndingInput {
  aliveCrew: number;
  totalCrew: number;
  order: number;
  survival: number;
  fragments: number;
  flags: Set<string>;
  cruelty: number;
  mutiny: boolean;
  stationLost: boolean;
  engineOnline: boolean;
  fuel: number;
}

export class EndingSystem {
  decide(i: EndingInput): EndingKey {
    if (i.fragments >= CONFIG.MYSTERY_FRAGMENTS_NEEDED && i.flags.has('follow_signal')) return 'mystery';
    if (i.mutiny || i.stationLost || i.aliveCrew === 0 || i.order < 30) return 'dark';
    const allAlive = i.aliveCrew === i.totalCrew;
    const dockable = i.engineOnline && i.fuel >= 20;
    if (allAlive && i.survival >= 50 && i.cruelty <= 2 && dockable && !i.flags.has('cruel')) return 'heroic';
    // فرمانده‌ای که "selfless" بوده و همه زنده‌اند ولی موتور/سوخت کم است، باز هم قهرمانانه
    if (allAlive && i.survival >= 65 && i.flags.has('selfless') && !i.flags.has('cruel')) return 'heroic';
    return 'sacrifice';
  }

  text(key: EndingKey, stats: { alive: number; order: number; survival: number; days: number }) {
    const e = ENDINGS[key];
    return [
      e.title,
      '',
      ...e.lines,
      '',
      `FINAL REPORT — Day ${stats.days} | Crew alive: ${stats.alive}/12 | Order: ${Math.round(stats.order)} | Survival index: ${Math.round(stats.survival)}`,
      'Type  restart  to command a new station.',
    ];
  }
}
