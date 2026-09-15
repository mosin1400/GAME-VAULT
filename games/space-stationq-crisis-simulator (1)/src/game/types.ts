/* ============================================================
   AVICENNA-7 — Type Definitions / تعریف تایپ‌ها
   ============================================================ */

export type ResourceKey = "oxygen" | "energy" | "water" | "food" | "fuel";
export type SystemKey = "oxygen" | "electrical" | "comms" | "heating" | "engine";
export type RationLevel = "low" | "medium" | "high";
export type Duty = "engineer" | "medic" | "security" | "scientist" | "cook" | "explorer" | "rest";
export type MoodState = "خوش‌بین" | "نگران" | "عصبی" | "افسرده";

export type CrewStatus =
  | "idle"       // آزاد
  | "repairing"  // در حال تعمیر
  | "exploring"  // در مأموریت اکتشافی
  | "injured"    // مجروح
  | "dead";      // مرده

export interface CrewMember {
  id: number;
  name: string;           // نام فارسی
  role: string;           // تخصص ذاتی (مهندس، پزشک و…)
  duty: Duty;             // وظیفه‌ی فعلی که فرمانده تعیین کرده
  mood: number;           // ۰ تا ۱۰۰
  status: CrewStatus;
  busyUntil: number;      // تیکی که کار فعلی تمام می‌شود
  injuredUntil: number;   // تیکی که مجروحی خوب می‌شود
  onMission: boolean;
}

export type SystemState = "online" | "damaged" | "repairing";
export interface StationSystem {
  key: SystemKey;
  fa: string;
  en: string;
  state: SystemState;
  repairProgress: number; // ۰ تا ۱
  repairTotal: number;
  crewAssigned: number[];
}

export interface LogEntry {
  id: number;
  tick: number;
  day: number;
  time: string;         // ساعت بازی HH:MM
  text: string;
  color: string;        // رنگ ANSI-like (کلید پالت)
  severity: "info" | "good" | "warn" | "bad" | "sys" | "story";
}

export interface ScenarioOption {
  label: string;
  morale: number;   // اثر بر روحیه‌ی خدمه
  order: number;    // اثر بر نظم ایستگاه
  survival: number; // اثر بر شانس بقا
  special?: string; // کلید اثر ویژه — در موتور تفسیر می‌شود
}

export interface Scenario {
  id: number;
  day: number;        // روز تقریبی وقوع
  title: string;
  text: string;
  options: [ScenarioOption, ScenarioOption, ScenarioOption];
}

export interface EarthMessage {
  id: number;
  day: number;
  plaintext: string;   // متن اصلی انگلیسی
  encrypted: string;   // رمز سزار
  decoded: boolean;
  effect?: string;     // اثر ویژه هنگام رمزگشایی
}

export interface SpaceObject {
  id: number;
  name: string;
  desc: string;
  appearsDay: number;
  expiresDay: number;
  resolved: boolean;
}

export interface Mission {
  crewIds: number[];
  objectName: string;
  returnsAt: number; // تیک بازگشت
  scientistBonus: boolean;
}

export type EndingType = "heroic" | "sacrificial" | "dark" | "mysterious";

export interface Ending {
  type: EndingType;
  title: string;
  lines: string[];   // متن روایی پایان
  stats: { label: string; value: string }[];
}

export interface Snapshot {
  phase: "boot" | "playing" | "ending";
  tick: number;
  day: number;
  time: string;
  isDaytime: boolean;
  paused: boolean;
  scenarioActive: boolean;
  activeScenario: Scenario | null;
  resources: Record<ResourceKey, { value: number; delta: number }>;
  systems: StationSystem[];
  crew: CrewMember[];
  alive: number;
  morale: number;   // میانگین روحیه
  order: number;    // نظم ایستگاه
  survival: number; // شانس بقا (محاسبه‌شده)
  ration: RationLevel;
  keys: number;
  artifacts: number;
  shuttleDamaged: boolean;
  messages: EarthMessage[];
  objects: SpaceObject[];
  activeMission: Mission | null;
  logs: LogEntry[];
  ending: Ending | null;
  soundOn: boolean;
}
