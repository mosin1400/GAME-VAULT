/* ============================================================
   AVICENNA-7 — Game Systems (modular classes)
   سیستم‌های بازی — هر زیرسیستم در یک کلاس جداگانه
   ------------------------------------------------------------
   ResourceManager      مدیریت ۵ منبع با نوارهای رنگی
   CrewManager          خدمه، روحیه، مرگ‌ومیر و تخصیص‌ها
   StationSystems       خرابی‌ها و تعمیرات ۵ سیستم ایستگاه
   MessageSystem        پیام‌های رمزگذاری‌شده‌ی زمین (سزار شیفت ۳)
   ExplorationManager   اشیاء ناشناخته و مأموریت‌های اکتشافی
   MoralSystem          زمان‌بندی سناریوهای اخلاقی
   ============================================================ */

import {
  CAESAR_SHIFT, CONSUME_PER_CREW, EXPLORE_ODDS, FUEL_THRUSTER_PER_CYCLE,
  HYDROPONIC_PER_SCIENTIST, RATION_DRAIN, RATION_MOOD, REGEN,
} from "./constants";
import { CREW_ROSTER, EARTH_MESSAGES, OBJECT_POOL, SCENARIOS } from "./data";
import type {
  CrewMember, EarthMessage, Mission, RationLevel, ResourceKey,
  Scenario, SpaceObject, StationSystem, SystemKey,
} from "./types";

export const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/* ═══════════════ رمز سزار / Caesar cipher ═══════════════
   حروف انگلیسی شیفت می‌خورند؛ ارقام و علامت‌ها ثابت می‌مانند. */
export function caesar(text: string, shift: number): string {
  return text.replace(/[A-Za-z]/g, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    const code = ((ch.charCodeAt(0) - base + shift) % 26 + 26) % 26;
    return String.fromCharCode(base + code);
  });
}
export const caesarEncrypt = (t: string) => caesar(t, CAESAR_SHIFT);
export const caesarDecrypt = (t: string) => caesar(t, -CAESAR_SHIFT);

/* ═══════════════ مدیریت منابع / Resource Manager ═══════════════ */
export class ResourceManager {
  values: Record<ResourceKey, number> = {
    oxygen: 82, energy: 90, water: 78, food: 85, fuel: 80,
  };
  deltas: Record<ResourceKey, number> = {
    oxygen: 0, energy: 0, water: 0, food: 0, fuel: 0,
  };
  private prev: Record<ResourceKey, number> = { ...this.values };

  add(key: ResourceKey, amt: number) {
    this.values[key] = clamp(this.values[key] + amt);
  }
  /** علامت روند برای فلش‌های ▲▼ در رابط کاربری */
  snapshotTrends() {
    (Object.keys(this.values) as ResourceKey[]).forEach((k) => {
      this.deltas[k] = this.values[k] - this.prev[k];
      this.prev[k] = this.values[k];
    });
  }

  /** چرخه‌ی مصرف/تولید — هر DRAIN_TICKS تیک یک‌بار صدا زده می‌شود
      Consumption cycle — called once every DRAIN_TICKS ticks. */
  cycle(opts: {
    alive: number;
    ration: RationLevel;
    isDaytime: boolean;
    oxygenSysOk: boolean;
    electricalOk: boolean;
    heatingOk: boolean;
    scientistsWorking: number;
    cooksWorking: number;
    leakActive: boolean;
  }) {
    const crewFactor = opts.alive / 12;
    // ── اکسیژن: مصرف خدمه + بازیافت (نیازمند انرژی و سیستم سالم)
    this.add("oxygen", -CONSUME_PER_CREW.o2 * opts.alive);
    if (opts.oxygenSysOk && this.values.energy > 5) this.add("oxygen", REGEN.o2 * crewFactor + 0.6);
    if (opts.leakActive) this.add("oxygen", -0.9);
    // ── آب: مصرف + بازچرخانی
    this.add("water", -CONSUME_PER_CREW.water * opts.alive);
    if (opts.oxygenSysOk && this.values.energy > 5) this.add("water", REGEN.water * crewFactor + 0.5);
    // ── انرژی: بار حیاتی + پنل خورشیدی (روز/شب) — خرابی الکترونیک = ۸۰٪ تلفات
    this.add("energy", -CONSUME_PER_CREW.energy * opts.alive);
    const solar = opts.isDaytime ? REGEN.energyDay : REGEN.energyNight;
    this.add("energy", opts.electricalOk ? solar : solar * 0.2);
    // ── غذا: جیره + هیدروپونیک دانشمندان + کش‌آمدن با آشپز
    const cookFactor = opts.cooksWorking > 0 ? 0.85 : 1;
    this.add("food", -RATION_DRAIN[opts.ration] * crewFactor * cookFactor);
    if (opts.scientistsWorking > 0 && this.values.water > 15)
      this.add("food", HYDROPONIC_PER_SCIENTIST * opts.scientistsWorking);
    // ── سوخت: رانشگرهای نگهدارنده‌ی مدار
    this.add("fuel", -FUEL_THRUSTER_PER_CYCLE);
    // ── گرمایش خراب = یخ‌زدگی بخشی از آب
    if (!opts.heatingOk) this.add("water", -0.35);
  }
}

/* ═══════════════ مدیریت خدمه / Crew Manager ═══════════════ */
export class CrewManager {
  crew: CrewMember[] = CREW_ROSTER.map((c, i) => ({
    id: i + 1, name: c.name, role: c.role, duty: c.duty as CrewMember["duty"],
    mood: Math.round(rand(62, 84)), status: "idle", busyUntil: 0,
    injuredUntil: 0, onMission: false,
  }));

  alive() { return this.crew.filter((c) => c.status !== "dead"); }
  countByDuty(duty: string, aliveOnly = true) {
    return this.crew.filter((c) => c.duty === duty && (!aliveOnly || c.status !== "dead")).length;
  }
  /** خدمه‌ی آزادِ قابل‌کار (نه مجروح، نه در مأموریت، نه مشغول تعمیر) */
  idle() {
    return this.crew.filter((c) => c.status === "idle" && c.duty !== "rest");
  }
  avgMood() {
    const a = this.alive();
    return a.length ? a.reduce((s, c) => s + c.mood, 0) / a.length : 0;
  }
  addMoodAll(delta: number) {
    this.alive().forEach((c) => (c.mood = clamp(c.mood + delta)));
  }
  kill(id: number): CrewMember | undefined {
    const c = this.crew.find((x) => x.id === id);
    if (c && c.status !== "dead") {
      c.status = "dead"; c.onMission = false; c.duty = "rest";
      return c;
    }
    return undefined;
  }
  injure(id: number, untilTick: number) {
    const c = this.crew.find((x) => x.id === id);
    if (c && c.status !== "dead") {
      c.status = "injured"; c.injuredUntil = untilTick; c.onMission = false; c.mood = clamp(c.mood - 18);
    }
  }
  /** انتخاب خودکار تیم اکتشاف: داوطلبان آزاد، با اولویت دانشمند/اکتشافگر */
  pickExplorers(n: number): CrewMember[] {
    const pool = this.idle().sort((a, b) => {
      const score = (c: CrewMember) =>
        (c.duty === "explorer" ? 2 : 0) + (c.duty === "scientist" ? 1.5 : 0) + c.mood / 100;
      return score(b) - score(a);
    });
    return pool.slice(0, n);
  }
}

/* ═══════════════ سیستم‌های ایستگاه / Station Systems ═══════════════ */
export class StationSystems {
  systems: StationSystem[] = (
    [
      ["oxygen", "اکسیژن‌رسانی", "O2 RECYCLER"],
      ["electrical", "الکترونیک", "ELECTRICAL"],
      ["comms", "ارتباطات", "COMMS"],
      ["heating", "گرمایش", "HEATING"],
      ["engine", "موتور", "ENGINE"],
    ] as [SystemKey, string, string][]
  ).map(([key, fa, en]) => ({
    key, fa, en, state: "online" as const, repairProgress: 0, repairTotal: 1, crewAssigned: [],
  }));

  get(key: SystemKey) { return this.systems.find((s) => s.key === key)!; }
  isOnline(key: SystemKey) { return this.get(key).state === "online"; }
  onlineCount() { return this.systems.filter((s) => s.state === "online").length; }

  damage(key: SystemKey) {
    const s = this.get(key);
    if (s.state === "online") {
      s.state = "damaged"; s.repairProgress = 0; s.crewAssigned = [];
    }
  }
  /** شروع تعمیر — نیاز به ۲ خدمه‌ی آزاد دارد (مهندسان در اولویت‌اند) */
  canRepair(key: SystemKey, crew: CrewManager): { ok: boolean; reason?: string; team?: CrewMember[] } {
    const s = this.get(key);
    if (s.state === "online") return { ok: false, reason: "سیستم سالم است — نیازی به تعمیر نیست." };
    if (s.state === "repairing") return { ok: false, reason: "تیم قبلاً در حال تعمیر است." };
    const idle = crew.idle();
    if (idle.length < 2) return { ok: false, reason: "خدمه‌ی آزاد کافی نیست — ۲ نفر لازم است." };
    const team = [...idle]
      .sort((a, b) => Number(b.duty === "engineer") - Number(a.duty === "engineer"))
      .slice(0, 2);
    return { ok: true, team };
  }
}

/* ═══════════════ پیام‌های زمین / Message System ═══════════════ */
export class MessageSystem {
  messages: EarthMessage[] = [];
  private pool = [...EARTH_MESSAGES];
  private nextId = 1;

  /** هر MESSAGE_EVERY_DAYS روز یک پیام می‌رسد (اگر ارتباطات سالم باشد) */
  arrive(day: number): EarthMessage | null {
    if (this.pool.length === 0) this.pool = [...EARTH_MESSAGES];
    const idx = Math.floor(Math.random() * this.pool.length);
    const m = this.pool.splice(idx, 1)[0];
    const msg: EarthMessage = {
      id: this.nextId++, day, plaintext: m.text,
      encrypted: caesarEncrypt(m.text), decoded: false, effect: m.effect,
    };
    this.messages.push(msg);
    return msg;
  }
  latest() { return this.messages[this.messages.length - 1] ?? null; }
  undecoded() { return this.messages.filter((m) => !m.decoded); }
}

/* ═══════════════ اکتشاف / Exploration Manager ═══════════════ */
export class ExplorationManager {
  objects: SpaceObject[] = [];
  mission: Mission | null = null;
  shuttleDamaged = false;
  artifacts = 0;
  keys = 1; // یک کلید اولیه تا چرخه‌ی رمزگشایی از همان ابتدا ممکن باشد
  techBonus = 0; // پاداش فناوری: سرعت تعمیر
  successBonus = 0; // پاداش موفقیت اکتشاف (از پیام‌های زمین)
  private nextId = 1;
  private usedObjects: string[] = [];

  /** ظهور شیء ناشناخته در روزهای از پیش تعیین‌شده */
  spawnObject(day: number) {
    const available = OBJECT_POOL.filter((o) => !this.usedObjects.includes(o.name));
    if (available.length === 0) return;
    const o = pick(available);
    this.usedObjects.push(o.name);
    this.objects.push({
      ...o, id: this.nextId++, appearsDay: day,
      expiresDay: day + 3, resolved: false,
    });
  }
  activeObject() { return this.objects.find((o) => !o.resolved) ?? null; }

  /** پرتاب تیم اکتشاف — اعتبارسنجی‌ها در موتور انجام می‌شود */
  launch(crew: CrewMember[], objectName: string, returnsAt: number) {
    const hasScientist = crew.some((c) => c.duty === "scientist");
    this.mission = {
      crewIds: crew.map((c) => c.id), objectName,
      returnsAt, scientistBonus: hasScientist,
    };
  }

  /** جدول تصادفی نتایج: ۴۰٪ موفق / ۳۰٪ خطرناک / ۲۰٪ فاجعه / ۱۰٪ رمزآلود */
  rollOutcome(): "success" | "danger" | "catastrophe" | "mystery" {
    const w = {
      success: EXPLORE_ODDS.success * 100 + (this.mission?.scientistBonus ? 10 : 0) + this.successBonus,
      danger: EXPLORE_ODDS.danger * 100,
      catastrophe: EXPLORE_ODDS.catastrophe * 100 + (this.shuttleDamaged ? 15 : 0),
      mystery: EXPLORE_ODDS.mystery * 100,
    };
    const total = w.success + w.danger + w.catastrophe + w.mystery;
    let r = Math.random() * total;
    if ((r -= w.success) < 0) return "success";
    if ((r -= w.danger) < 0) return "danger";
    if ((r -= w.catastrophe) < 0) return "catastrophe";
    return "mystery";
  }
}

/* ═══════════════ سیستم اخلاقی / Moral System ═══════════════ */
export class MoralSystem {
  private triggered = new Set<number>();
  /** سناریویی که روزش رسیده و هنوز اتفاق نیفتاده */
  nextForDay(day: number): Scenario | null {
    const s = SCENARIOS.find((x) => !this.triggered.has(x.id) && day >= x.day);
    return s ?? null;
  }
  mark(id: number) { this.triggered.add(id); }
  get count() { return this.triggered.size; }
  reset() { this.triggered.clear(); }
}

/** سطح جیره به عدد — برای نمایش نوار و محاسبات */
export const RATION_FA: Record<RationLevel, string> = {
  low: "کم", medium: "متوسط", high: "زیاد",
};
export const RATION_MOOD_DAILY = RATION_MOOD;
