/**
 * ============================================================
 *  FailureSystem — خرابی‌های تصادفی و تعمیرات
 * ============================================================
 *  سیستم‌ها: oxygen, electrical, comms, heating, engine
 *  خرابی‌ها: نشت اکسیژن، آتش‌سوزی، نفوذ موجودات فضایی، طوفان خورشیدی،
 *            نقص کامپیوتر مرکزی
 *  هر تعمیر: REPAIR_WORK_UNITS واحد کار، REPAIR_CREW_REQUIRED خدمه.
 *  سرعت تعمیر = مجموع کارایی تعمیرکاران (روحیه پایین → تعمیر کند).
 */
import { CONFIG, SYSTEM_KEYS, clamp, pick } from './types';
import type { CrewMember, FailureType, LogColor, ResourceKey, StationSystem, SystemKey } from './types';

/** تعریف هر نوع خرابی: کدام سیستم را می‌زند و اثر فوری آن چیست */
export const FAILURE_DEFS: Record<
  FailureType,
  {
    label: string;
    systems: SystemKey[]; // سیستم‌هایی که این خرابی ممکن است هدف بگیرد
    immediate: Partial<Record<ResourceKey, number>>; // ضربه‌ی فوری به منابع
    moraleHit: number;
    injuryChance: number; // احتمال مصدومیت خدمه
    text: string;
    color: LogColor;
  }
> = {
  oxygen_leak: {
    label: 'OXYGEN LEAK',
    systems: ['oxygen'],
    immediate: { oxygen: -12 },
    moraleHit: -5,
    injuryChance: 0.2,
    text: 'Hull seal failure — oxygen venting into space!',
    color: 'red',
  },
  fire: {
    label: 'FIRE',
    systems: ['electrical', 'heating'],
    immediate: { oxygen: -8, energy: -10 },
    moraleHit: -7,
    injuryChance: 0.45,
    text: 'Fire in the module! Suppression foam deployed.',
    color: 'red',
  },
  alien_intrusion: {
    label: 'ALIEN INTRUSION',
    systems: ['comms', 'engine', 'oxygen'],
    immediate: { food: -6, water: -4 },
    moraleHit: -12,
    injuryChance: 0.5,
    text: 'Unknown organisms detected inside the station! Security responding.',
    color: 'magenta',
  },
  solar_storm: {
    label: 'SOLAR STORM',
    systems: ['electrical', 'comms'],
    immediate: { energy: -18 },
    moraleHit: -4,
    injuryChance: 0.15,
    text: 'Solar storm! Radiation spike — electronics fried.',
    color: 'yellow',
  },
  computer_fault: {
    label: 'CENTRAL COMPUTER FAULT',
    systems: ['electrical', 'engine', 'heating', 'comms'],
    immediate: { energy: -6, fuel: -5 },
    moraleHit: -3,
    injuryChance: 0.05,
    text: 'Central computer fault — automated systems offline.',
    color: 'yellow',
  },
};

const LABELS: Record<SystemKey, string> = {
  oxygen: 'Life Support (O2)',
  electrical: 'Electrical Grid',
  comms: 'Communications',
  heating: 'Thermal Control',
  engine: 'Main Engine',
};

export interface FailureEvent {
  type: FailureType;
  system: SystemKey;
  def: (typeof FAILURE_DEFS)[FailureType];
}

export class FailureSystem {
  systems: StationSystem[] = SYSTEM_KEYS.map((k) => ({
    key: k,
    label: LABELS[k],
    broken: false,
    repairProgress: 0,
    repairCrew: [],
    integrity: 100,
  }));
  lastFailureAt = 0; // زمان آخرین خرابی (برای اجبار هر ۵ دقیقه)

  get(key: SystemKey) {
    return this.systems.find((s) => s.key === key)!;
  }
  broken() {
    return this.systems.filter((s) => s.broken);
  }
  brokenMap(): Record<string, boolean> {
    const m: Record<string, boolean> = {};
    for (const s of this.systems) m[s.key] = s.broken;
    return m;
  }
  activeCount() {
    return this.systems.filter((s) => !s.broken).length;
  }
  static parseSystem(s: string): SystemKey | null {
    const k = s.toLowerCase();
    return (SYSTEM_KEYS as string[]).includes(k) ? (k as SystemKey) : null;
  }

  /**
   * بررسی خرابی (هر دقیقه). احتمال پایه ۲۰٪؛ عوامل تشدیدکننده:
   *  - هر سیستم خراب +۵٪  (اثر آبشاری)
   *  - انرژی < ۲۰ → +۱۰٪
   *  - یکپارچگی پایین سیستم‌ها
   *  - اگر ۵ دقیقه بدون خرابی گذشته، اجباری است
   */
  maybeFail(now: number, energy: number, force = false): FailureEvent | null {
    const brokenN = this.broken().length;
    let chance = CONFIG.FAILURE_CHANCE + brokenN * 0.05 + (energy < 20 ? 0.1 : 0);
    const overdue = now - this.lastFailureAt >= CONFIG.FORCED_FAILURE_INTERVAL;
    if (!force && !overdue && Math.random() > chance) return null;

    // انتخاب سیستم سالم (وزن‌دهی بر اساس یکپارچگی پایین)
    const healthy = this.systems.filter((s) => !s.broken);
    if (!healthy.length) return null;
    const weighted = healthy.flatMap((s) => Array(Math.max(1, Math.round((110 - s.integrity) / 10))).fill(s));
    const target: StationSystem = pick(weighted);

    // انتخاب نوع خرابی سازگار با آن سیستم
    const types = (Object.keys(FAILURE_DEFS) as FailureType[]).filter((t) => FAILURE_DEFS[t].systems.includes(target.key));
    const type = pick(types);

    target.broken = true;
    target.failure = type;
    target.repairProgress = 0;
    target.repairCrew = [];
    target.integrity = clamp(target.integrity - 15);
    this.lastFailureAt = now;
    return { type, system: target.key, def: FAILURE_DEFS[type] };
  }

  /** شروع تعمیر با تیم مشخص. برمی‌گرداند پیام خطا یا null */
  startRepair(key: SystemKey, crew: CrewMember[]): string | null {
    const s = this.get(key);
    if (!s.broken) return `${s.label} is operational — nothing to repair.`;
    if (s.repairCrew.length) return `${s.label} is already under repair.`;
    if (crew.length < CONFIG.REPAIR_CREW_REQUIRED) return `Need at least ${CONFIG.REPAIR_CREW_REQUIRED} available crew to repair.`;
    s.repairCrew = crew.map((c) => c.id);
    for (const c of crew) c.status = 'repairing';
    return null;
  }

  /**
   * پیشرفت تعمیر (هر ۱۰ ثانیه). هر تعمیرکار به اندازه‌ی کارایی‌اش کار می‌کند.
   * انرژی صفر → تعمیر نصف سرعت (بدون ابزار برقی).
   * برمی‌گرداند لیست سیستم‌های تعمیرشده.
   */
  tickRepairs(efficiencyOf: (id: number) => number, lowEnergy: boolean): StationSystem[] {
    const fixed: StationSystem[] = [];
    for (const s of this.systems) {
      if (!s.broken || !s.repairCrew.length) continue;
      const work = s.repairCrew.reduce((sum, id) => sum + efficiencyOf(id), 0) * (lowEnergy ? 0.5 : 1);
      s.repairProgress += work;
      if (s.repairProgress >= CONFIG.REPAIR_WORK_UNITS) {
        s.broken = false;
        s.failure = undefined;
        s.repairProgress = 0;
        fixed.push(s);
      }
    }
    return fixed;
  }

  /** آزادسازی خدمه‌ی تعمیرکار پس از اتمام */
  releaseCrew(s: StationSystem, byId: (id: number) => CrewMember) {
    for (const id of s.repairCrew) {
      const c = byId(id);
      if (c.status === 'repairing') c.status = c.health < 40 ? 'injured' : 'active';
    }
    s.repairCrew = [];
  }

  /** بازیابی تدریجی یکپارچگی سیستم‌های سالم توسط مهندسان */
  tickIntegrity(engineerCount: number) {
    for (const s of this.systems) {
      if (!s.broken) s.integrity = clamp(s.integrity + 0.05 * engineerCount);
    }
  }
}
