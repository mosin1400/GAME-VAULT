/**
 * ============================================================
 *  types.ts — Shared types & tunable constants
 *  انواع مشترک و ثابت‌های قابل تنظیم بازی
 * ============================================================
 *  برای شخصی‌سازی سرعت/سختی بازی، ثابت‌های بخش CONFIG را تغییر دهید.
 *  To customise pacing/difficulty, tweak the CONFIG block below.
 */

// ---------- CONFIG / پیکربندی ----------
export const CONFIG = {
  TOTAL_DAYS: 30, // طول مأموریت (روز)
  DAY_SECONDS: 120, // هر روز = ۱۲۰ ثانیه واقعی
  DRAIN_INTERVAL: 10, // کاهش منابع هر ۱۰ ثانیه
  // قانون اصلی: ۱ واحد به ازای هر ۵ خدمه در هر سیستم فعال، هر ۱۰ ثانیه.
  // DRAIN_SCALE برای متعادل‌سازی یک بازی ۶۰ دقیقه‌ای اعمال می‌شود (۱ = قانون خام).
  DRAIN_SCALE: 0.25,
  FAILURE_CHECK_INTERVAL: 60, // بررسی خرابی هر ۶۰ ثانیه
  FAILURE_CHANCE: 0.2, // احتمال ۲۰٪ در هر دقیقه
  FORCED_FAILURE_INTERVAL: 300, // حداکثر ۵ دقیقه بدون خرابی
  REPAIR_WORK_UNITS: 10, // هر تعمیر ۱۰ واحد کار نیاز دارد
  REPAIR_CREW_REQUIRED: 2, // هر تعمیر ۲ خدمه نیاز دارد
  MESSAGE_INTERVAL: 120, // پیام زمین هر ۲ دقیقه
  EXPLORE_INTERVAL: 600, // شیء ناشناس هر ۱۰ دقیقه
  EXPLORE_DURATION: 90, // مدت مأموریت اکتشافی (ثانیه)
  EXPLORE_FUEL_COST: 8, // سوخت مصرفی هر مأموریت
  ETHICS_FIRST_DAY: 2, // اولین دوراهی اخلاقی در روز ۲
  ETHICS_EVERY_DAYS: 3, // سپس هر ۳ روز (۱۰ سناریو تا روز ۲۹)
  SLEEP_SECONDS: 600, // دستور sleep = ۱۰ دقیقه
  CAESAR_SHIFT: 3, // شیفت رمز سزار
  MYSTERY_FRAGMENTS_NEEDED: 3, // قطعات لازم برای پایان مرموز (یکی از سناریوی سیگنال + اکتشافات)
};

export const TOTAL_SECONDS = CONFIG.TOTAL_DAYS * CONFIG.DAY_SECONDS;

// ---------- Resources / منابع ----------
export type ResourceKey = 'oxygen' | 'energy' | 'water' | 'food' | 'fuel';
export const RESOURCE_KEYS: ResourceKey[] = ['oxygen', 'energy', 'water', 'food', 'fuel'];
export type Resources = Record<ResourceKey, number>;

export type RationLevel = 'low' | 'normal' | 'high';

// ---------- Crew / خدمه ----------
export type CrewRole = 'engineer' | 'medic' | 'security' | 'scientist';
export type CrewTask = 'engineer' | 'medic' | 'security' | 'scientist' | 'cook' | 'explorer' | 'idle';
export const CREW_TASKS: CrewTask[] = ['engineer', 'medic', 'security', 'scientist', 'cook', 'explorer', 'idle'];
export type Mood = 'optimistic' | 'worried' | 'nervous' | 'depressed';
export type CrewStatus = 'active' | 'repairing' | 'away' | 'injured' | 'dead';

export interface CrewMember {
  id: number;
  name: string;
  role: CrewRole; // تخصص اصلی
  task: CrewTask; // وظیفه‌ی فعلی
  morale: number; // 0-100 وضعیت روحی
  health: number; // 0-100 سلامت
  status: CrewStatus;
  // نیازهای روزانه (واحد منبع در روز)
  needs: { food: number; water: number; oxygen: number };
  deathCause?: string;
}

// ---------- Station systems & failures / سیستم‌ها و خرابی‌ها ----------
export type SystemKey = 'oxygen' | 'electrical' | 'comms' | 'heating' | 'engine';
export const SYSTEM_KEYS: SystemKey[] = ['oxygen', 'electrical', 'comms', 'heating', 'engine'];

export type FailureType = 'oxygen_leak' | 'fire' | 'alien_intrusion' | 'solar_storm' | 'computer_fault';

export interface StationSystem {
  key: SystemKey;
  label: string;
  broken: boolean;
  failure?: FailureType; // نوع خرابی فعلی
  repairProgress: number; // 0..REPAIR_WORK_UNITS
  repairCrew: number[]; // آی‌دی خدمه‌ی مشغول تعمیر
  integrity: number; // 0-100 (پایین‌تر = احتمال خرابی بیشتر)
}

// ---------- Ethics / اخلاق ----------
export interface EthicsOption {
  text: string;
  effects: { morale: number; order: number; survival: number };
  outcome: string; // متن پیامد
  extra?: (ctx: EthicsContext) => void; // پیامد ویژه (اختیاری)
}
export interface EthicsScenario {
  id: number;
  title: string;
  description: string;
  options: [EthicsOption, EthicsOption, EthicsOption];
}
/** رابطی که سناریوها برای اعمال پیامدهای خاص از آن استفاده می‌کنند */
export interface EthicsContext {
  addResource: (k: ResourceKey, amt: number) => void;
  killRandomCrew: (cause: string) => string | null;
  healAll: (amt: number) => void;
  addKey: (n: number) => void;
  addFragment: () => void; // قطعه‌ی پایان مرموز
  log: (text: string, color?: LogColor) => void;
  setFlag: (flag: string) => void;
}

// ---------- Messages / پیام‌ها ----------
export interface EarthMessage {
  id: number;
  day: number;
  plain: string;
  cipher: string;
  decrypted: boolean;
  kind: 'warning' | 'order' | 'rescue';
}

// ---------- Exploration / اکتشاف ----------
export type ExploreOutcome = 'success' | 'danger' | 'catastrophe' | 'mystery';
export interface Expedition {
  crewIds: number[];
  startedAt: number;
  endsAt: number;
  objectName: string;
}

// ---------- Endings / پایان‌ها ----------
export type EndingKey = 'heroic' | 'sacrifice' | 'dark' | 'mystery';

// ---------- Logging / لاگ ----------
export type LogColor = 'green' | 'red' | 'yellow' | 'cyan' | 'magenta' | 'white' | 'gray' | 'blue';
export interface LogEntry {
  time: string; // "D03 14:20"
  text: string;
  color: LogColor;
}
export interface ConsoleLine {
  text: string;
  color?: LogColor;
}

// ---------- Overall game state snapshot / تصویر لحظه‌ای وضعیت ----------
export type Phase = 'intro' | 'playing' | 'ended';

export interface GameSnapshot {
  phase: Phase;
  time: number; // ثانیه‌ی سپری‌شده
  day: number;
  resources: Resources;
  crew: CrewMember[];
  systems: StationSystem[];
  log: LogEntry[];
  console: ConsoleLine[];
  order: number;
  survival: number;
  rations: RationLevel;
  keys: number;
  fragments: number;
  messages: EarthMessage[];
  pendingScenario: EthicsScenario | null;
  expedition: Expedition | null;
  objectAvailable: string | null;
  ending: EndingKey | null;
  endingText: string[];
  sleeping: boolean;
}

// helpers
export const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
