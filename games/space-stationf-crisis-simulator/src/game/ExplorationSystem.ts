/**
 * ============================================================
 *  ExplorationSystem — اکتشاف فضایی
 * ============================================================
 *  هر ۱۰ دقیقه یک شیء ناشناس شناسایی می‌شود. فرمانده می‌تواند تیم ۲ تا ۴
 *  نفره بفرستد. نتیجه پس از EXPLORE_DURATION ثانیه مشخص می‌شود:
 *   40% success | 30% danger | 20% catastrophe | 10% mystery
 *  کارایی تیم (روحیه/سلامت) کمی احتمال موفقیت را جابه‌جا می‌کند.
 */
import { CONFIG, pick, rand } from './types';
import type { CrewMember, Expedition, ExploreOutcome, ResourceKey } from './types';
import { OBJECT_NAMES } from './data/messages';

export interface ExploreResult {
  outcome: ExploreOutcome;
  lines: string[]; // متن روایی
  resources: Partial<Record<ResourceKey, number>>;
  keys: number; // کلید رمزگشایی
  fragment: boolean; // قطعه‌ی پایان مرموز
  casualties: number[]; // آی‌دی کشته‌ها
  injuries: number[]; // آی‌دی مصدومان
  shuttleDamage: number; // آسیب به سفینه (۰-۱۰۰)
}

export class ExplorationSystem {
  currentObject: string | null = null; // شیء قابل بررسی
  active: Expedition | null = null; // مأموریت در جریان
  shuttleIntegrity = 100; // سلامت سفینه‌ی کوچک
  missions = 0;

  /** شناسایی شیء جدید (هر ۱۰ دقیقه) */
  detect(): string {
    this.currentObject = pick(OBJECT_NAMES);
    return this.currentObject;
  }

  /** اعتبارسنجی و شروع مأموریت. برمی‌گرداند خطا یا null */
  launch(team: CrewMember[], size: number, now: number, fuel: number, engineBroken: boolean): string | null {
    if (size < 2 || size > 4) return 'Team size must be between 2 and 4.';
    if (!this.currentObject) return 'No object in range. Wait for the next detection.';
    if (this.active) return 'Shuttle is already on a mission.';
    if (this.shuttleIntegrity < 25) return 'Shuttle too damaged to launch. Engineers will repair it over time.';
    if (engineBroken) return 'Main engine offline — docking bay cannot cycle.';
    if (fuel < CONFIG.EXPLORE_FUEL_COST) return `Insufficient fuel (need ${CONFIG.EXPLORE_FUEL_COST}).`;
    if (team.length < size) return `Only ${team.length} crew available for the mission.`;
    this.active = {
      crewIds: team.map((c) => c.id),
      startedAt: now,
      endsAt: now + CONFIG.EXPLORE_DURATION,
      objectName: this.currentObject,
    };
    for (const c of team) c.status = 'away';
    this.currentObject = null;
    this.missions++;
    return null;
  }

  /** آیا مأموریت به پایان رسیده؟ */
  isDue(now: number) {
    return this.active !== null && now >= this.active.endsAt;
  }

  /**
   * جدول نتایج. teamQuality (میانگین کارایی ۰.۳..۱.۶) موفقیت را تا ±۱۰٪ جابه‌جا می‌کند.
   */
  resolve(teamQuality: number, answeredSignal: boolean, fragmentsHeld = 0): ExploreResult {
    const exp = this.active!;
    this.active = null;
    const shift = (teamQuality - 1) * 0.1;
    const roll = Math.random();
    let outcome: ExploreOutcome;
    // پایان مرموز: پایه ۱۰٪؛ پاسخ به سیگنال +۸٪؛ هر قطعه‌ی موجود +۱۰٪ («قطعات همدیگر را می‌خوانند»)
    const mysteryChance = Math.min(0.4, 0.1 + (answeredSignal ? 0.08 : 0) + fragmentsHeld * 0.1);
    if (roll < 0.4 + shift) outcome = 'success';
    else if (roll < 0.7 + shift) outcome = 'danger';
    else if (roll < 1 - mysteryChance) outcome = 'catastrophe';
    else outcome = 'mystery';

    const res: ExploreResult = {
      outcome,
      lines: [],
      resources: {},
      keys: 0,
      fragment: false,
      casualties: [],
      injuries: [],
      shuttleDamage: 0,
    };
    const ids = exp.crewIds;

    switch (outcome) {
      case 'success': {
        const k: ResourceKey = pick(['oxygen', 'energy', 'water', 'food', 'fuel'] as ResourceKey[]);
        const amt = Math.round(rand(12, 28) * (1 + ids.length * 0.1));
        res.resources[k] = amt;
        res.keys = Math.random() < 0.7 ? 1 : 2;
        res.lines = [
          `The team boards ${exp.objectName}.`,
          `Salvage complete: +${amt} ${k.toUpperCase()} recovered.`,
          `A data core is found — ${res.keys} decryption key${res.keys > 1 ? 's' : ''} extracted.`,
        ];
        if (Math.random() < 0.3) {
          res.resources.energy = (res.resources.energy ?? 0) + 8;
          res.lines.push('Bonus: an intact power cell (+8 ENERGY).');
        }
        break;
      }
      case 'danger': {
        res.shuttleDamage = Math.round(rand(15, 35));
        const nInj = Math.min(ids.length, 1 + Math.floor(Math.random() * 2));
        res.injuries = [...ids].sort(() => Math.random() - 0.5).slice(0, nInj);
        res.keys = Math.random() < 0.35 ? 1 : 0;
        res.lines = [
          `${exp.objectName} is unstable. Debris strikes the shuttle.`,
          `Shuttle integrity -${res.shuttleDamage}%. ${nInj} crew injured.`,
        ];
        if (res.keys) res.lines.push('They still recovered a partial data core (+1 key).');
        if (Math.random() < 0.4) {
          res.resources.fuel = Math.round(rand(5, 12));
          res.lines.push(`Some fuel siphoned before retreat (+${res.resources.fuel} FUEL).`);
        }
        break;
      }
      case 'catastrophe': {
        res.casualties = [...ids];
        res.shuttleDamage = 60;
        res.lines = [
          `Contact lost with the shuttle near ${exp.objectName}.`,
          'Telemetry shows a rapid decompression. No survivors.',
          `${ids.length} crew lost. The shuttle drifts back on autopilot, ruined.`,
        ];
        break;
      }
      case 'mystery': {
        res.fragment = true;
        res.keys = 1;
        res.lines = [
          `Inside ${exp.objectName} the team finds a chamber that should not exist.`,
          'Walls covered in a repeating pattern. One panel comes loose in Farahani\u2019s hands.',
          'A FRAGMENT recovered. It hums when placed near the comms array.',
        ];
        break;
      }
    }
    this.shuttleIntegrity = Math.max(0, this.shuttleIntegrity - res.shuttleDamage);
    return res;
  }

  /** تعمیر تدریجی سفینه توسط مهندسان (هر ۱۰ ثانیه) */
  tickShuttleRepair(engineerCount: number) {
    if (!this.active && this.shuttleIntegrity < 100) this.shuttleIntegrity = Math.min(100, this.shuttleIntegrity + 0.15 * engineerCount);
  }
}
