/* ============================================================
   AVICENNA-7 — Game Engine / موتور اصلی بازی
   ------------------------------------------------------------
   هماهنگ‌کننده‌ی همه‌ی زیرسیستم‌ها: حلقه‌ی زمان، زنجیره‌ی بحران
   (اکسیژن ← روحیه ← کارایی تعمیر ← خرابی بیشتر)، فرمان‌ها و پایان‌ها.
   Orchestrates time loop, the crisis cascade chain, command
   parsing and ending resolution.
   ============================================================ */

import {
  DRAIN_TICKS, FAILURE_CHANCE_PER_HOUR, FINAL_DAY, FUEL_PER_LAUNCH,
  FUEL_TO_BROADCAST, MIN_PER_TICK, MUTINY_ORDER_FLOOR, MYSTERY_ARTIFACTS,
  MIN_CREW_SACRIFICIAL, OBJECT_DAYS, RATION_MOOD, REPAIR_BASE_TICKS,
  SLEEP_GAME_HOURS, SUICIDE_CHANCE, MESSAGE_EVERY_DAYS, TICK_MS,
} from "./constants";
import { DUTY_FA, ENDING_ART, FAILURE_EVENTS, HELP_LINES, SYSTEM_FA } from "./data";
import {
  caesarDecrypt, clamp, CrewManager, ExplorationManager, MessageSystem,
  MoralSystem, pick, rand, RATION_FA, ResourceManager, StationSystems,
} from "./systems";
import type {
  CrewMember, Ending, EndingType, LogEntry, RationLevel, ResourceKey, Scenario, SystemKey,
} from "./types";

export type SoundType = "blip" | "good" | "bad" | "alarm" | "msg" | "mystery";
const TICKS_PER_DAY = 1440 / MIN_PER_TICK; // 120 تیک در روز

// رویدادهای خرابیِ داستانی که در روزهای مشخصی حتمی‌اند
const SCHEDULED_FAILURES: Record<number, string> = {
  3: "leak", 7: "fire", 11: "alien", 16: "storm", 21: "computer", 25: "alien",
};

export class GameEngine {
  // ── وضعیت کلی ──
  phase: "boot" | "playing" | "ending" = "boot";
  tick = 0;
  paused = false;
  scenarioActive = false;
  activeScenario: Scenario | null = null;
  ending: Ending | null = null;
  soundOn = true;

  // ── زیرسیستم‌ها ──
  resources = new ResourceManager();
  crewMgr = new CrewManager();
  systems = new StationSystems();
  msgSys = new MessageSystem();
  expSys = new ExplorationManager();
  moralSys = new MoralSystem();

  // ── معیارهای کلان ──
  order = 80;            // نظم ایستگاه ۰-۱۰۰
  survivalBonus = 0;     // جمع اثر تصمیمات اخلاقی بر شانس بقا
  ration: RationLevel = "medium";
  decisionsMade = 0;
  keysUsed = 0;

  // ── پرچم‌های رویدادها ──
  private flags: Record<string, number | boolean> = {
    stormWarned: false, mutinySeed: false, lieKept: 0, hiddenRation: 0,
    commanderBrave: false, finalTriggered: false, lastAlarm: -99,
    lastSuffocation: 0, lastDehydration: 0, lastStarvation: 0,
  };
  private leakActive = false; // نشت اکسیژن فعال تا تعمیر
  private lastFailureKey = ""; // برای پرهیز از تکرار پشت‌سرهم یک رویداد

  logs: LogEntry[] = [];
  private logId = 1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  onSound: ((t: SoundType) => void) | null = null;

  /* ─────────────── API برای React ─────────────── */
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
  private emit() { this.listeners.forEach((fn) => fn()); }
  private sound(t: SoundType) { if (this.soundOn && this.onSound) this.onSound(t); }

  /* ─────────────── زمان / Time helpers ─────────────── */
  get day() { return Math.floor(this.tick / TICKS_PER_DAY) + 1; }
  get minutes() { return (this.tick % TICKS_PER_DAY) * MIN_PER_TICK; }
  get timeStr() {
    const h = Math.floor(this.minutes / 60), m = this.minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  get isDaytime() { const h = this.minutes / 60; return h >= 6 && h < 18; }
  private setFlag(k: string, v: number | boolean) { this.flags[k] = v; }
  private flag(k: string) { return this.flags[k]; }

  /* ─────────────── شروع و راه‌اندازی ─────────────── */
  start() {
    if (this.phase === "boot") this.phase = "playing";
    this.introLogs();
    this.timer = setInterval(() => this.advance(), TICK_MS);
    this.emit();
  }
  destroy() { if (this.timer) clearInterval(this.timer); }

  restart() {
    if (this.timer) clearInterval(this.timer);
    this.resources = new ResourceManager();
    this.crewMgr = new CrewManager();
    this.systems = new StationSystems();
    this.msgSys = new MessageSystem();
    this.expSys = new ExplorationManager();
    this.moralSys = new MoralSystem();
    this.tick = 0; this.order = 80; this.survivalBonus = 0;
    this.ration = "medium"; this.decisionsMade = 0; this.keysUsed = 0;
    this.flags = {
      stormWarned: false, mutinySeed: false, lieKept: 0, hiddenRation: 0,
      commanderBrave: false, finalTriggered: false, lastAlarm: -99,
      lastSuffocation: 0, lastDehydration: 0, lastStarvation: 0,
    };
    this.leakActive = false; this.lastFailureKey = "";
    this.logs = []; this.ending = null;
    this.scenarioActive = false; this.activeScenario = null;
    this.phase = "playing"; this.paused = false;
    this.introLogs();
    this.timer = setInterval(() => this.advance(), 1000);
    this.emit();
  }

  private introLogs() {
    this.log("sys", "── سیستم‌های حیاتی AVICENNA-7 آنلاین شدند ──");
    this.log("story", "مدار زمین ثابت، روز اول. شما فرمانده‌ی ۱۲ نفر هستید.");
    this.log("story", "اتصال اصلی با زمین ناپایدار است؛ تیم نجات «هم‌وند» در راه است.");
    this.log("warn", "دستور زمین: ایستگاه را ۳۰ روز سرِ پا نگه دارید. به هر قیمتی.");
    this.log("info", "برای فهرست فرمان‌ها «help» را وارد کنید.");
  }

  log(sev: LogEntry["severity"], text: string) {
    this.logs.push({
      id: this.logId++, tick: this.tick, day: this.day, time: this.timeStr,
      text, color: sev, severity: sev,
    });
    if (this.logs.length > 80) this.logs.splice(0, this.logs.length - 80);
    this.emit();
  }

  /* ═══════════════ حلقه‌ی زمان / Main loop ═══════════════ */
  private advance() {
    if (this.phase !== "playing" || this.paused || this.scenarioActive) return;
    this.tick++;
    const prevDay = Math.floor((this.tick - 1) / TICKS_PER_DAY) + 1;
    const newDay = this.day !== prevDay;

    // ── ۱) چرخه‌ی منابع هر DRAIN_TICKS تیک ──
    if (this.tick % DRAIN_TICKS === 0) {
      this.resources.cycle({
        alive: this.crewMgr.alive().length,
        ration: this.ration,
        isDaytime: this.isDaytime,
        oxygenSysOk: this.systems.isOnline("oxygen"),
        electricalOk: this.systems.isOnline("electrical"),
        heatingOk: this.systems.isOnline("heating"),
        scientistsWorking: this.crewMgr.countByDuty("scientist"),
        cooksWorking: this.crewMgr.countByDuty("cook"),
        leakActive: this.leakActive,
      });
      this.resources.snapshotTrends();
    }

    // ── ۲) احتمال خرابی تصادفی هر ساعت بازی (هر ۵ تیک) ──
    // رویداد تکراری پشت‌سرهم نمی‌آید و طوفان خورشیدی وزن کمتری دارد
    if (this.tick % 5 === 0 && Math.random() < this.failureChance()) {
      const pool = FAILURE_EVENTS.filter(
        (e) => e.key !== this.lastFailureKey && (e.key !== "storm" || this.day > 5),
      );
      const weighted = pool.flatMap((e) => (e.key === "storm" ? [e] : [e, e]));
      if (weighted.length) {
        const ev = pick(weighted);
        this.lastFailureKey = ev.key;
        this.applyFailureEvent(ev.key, false);
      }
    }

    // ── ۳) پیشرفت تعمیرات — سرعت تابع «کارایی» است (زنجیره‌ی بحران) ──
    this.progressRepairs();

    // ── ۴) بازگشت تیم اکتشاف ──
    if (this.expSys.mission && this.tick >= this.expSys.mission.returnsAt) this.resolveMission();

    // ── ۴٫۵) آزادسازی خدمه از کارهای کوتاه‌مدت (مثل جوشکاری سفینه) ──
    this.crewMgr.crew.forEach((c) => {
      if (c.status === "repairing" && c.busyUntil > 0 && this.tick >= c.busyUntil) {
        const stillAssigned = this.systems.systems.some(
          (s) => s.state === "repairing" && s.crewAssigned.includes(c.id),
        );
        if (!stillAssigned) { c.status = "idle"; c.busyUntil = 0; }
      }
    });

    // ── ۵) بهبود مجروحان (با پزشکِ سرِ کار سریع‌تر) ──
    const medic = this.crewMgr.countByDuty("medic") > 0;
    this.crewMgr.crew.forEach((c) => {
      if (c.status === "injured" && this.tick >= c.injuredUntil - (medic ? 30 : 0)) {
        c.status = "idle";
        this.log("good", `${c.name} بهبود یافت و به خدمت بازگشت.`);
      }
    });

    // ── ۶) رویدادهای روزانه ──
    if (newDay) this.dailyUpdate();

    // ── ۷) مرگ‌ومیر ناشی از منابع صفر ──
    this.checkResourceDeaths();

    // ── ۸) هشدار اکسیژن بحرانی ──
    const o2 = this.resources.values.oxygen;
    if (o2 < 15 && this.tick - (this.flag("lastAlarm") as number) > 25) {
      this.setFlag("lastAlarm", this.tick);
      this.log("bad", `⚠ هشدار حیاتی: اکسیژن ${Math.round(o2)}٪ — سیستم اکسیژن‌رسانی را دریابید!`);
      this.sound("alarm");
    }

    // ── ۹) سناریوی اخلاقی بعدی؟ (زمان می‌ایستد) ──
    if (this.phase === "playing" && !this.scenarioActive && this.day <= FINAL_DAY) {
      const s = this.moralSys.nextForDay(this.day);
      if (s) this.openScenario(s);
    }

    // ── ۱۰) پایان روز ۳۰ ──
    if (this.phase === "playing" && this.day >= FINAL_DAY && !this.flag("finalTriggered")) {
      this.setFlag("finalTriggered", true);
      this.openFinalScene();
    }

    // ── ۱۱) پایان زودهنگام: همه مرده‌اند ──
    if (this.crewMgr.alive().length === 0 && this.phase === "playing") {
      this.finishEnding("dark", "آخرین نفس", [
        "آخرین چراغ AVICENNA-7 خاموش شد.",
        "هیچ‌کس نماند تا گزارش را بنویسد؛ گزارش خودش را نوشت:",
        "«ایستگاه ساکت است. فقط صدای چکه‌ی آب در بخش B می‌آید.»",
        "زمین هرگز نفهمید آخرش چه شد.",
      ]);
    }

    this.emit();
  }

  /** احتمال خرابی در هر ساعت — با روز، روحیه و تعداد مهندسان تعدیل می‌شود
      Failure chance per game-hour; scales with day, mood, engineer staffing. */
  private failureChance() {
    const engineers = this.crewMgr.countByDuty("engineer");
    const moodFactor = this.crewMgr.avgMood() < 40 ? 1.35 : 1;
    const staffFactor = Math.max(0.45, 1 - 0.12 * engineers);
    const dayFactor = 1 + this.day / 45;
    return FAILURE_CHANCE_PER_HOUR * moodFactor * staffFactor * dayFactor;
  }

  /* ═══════════════ رویدادهای خرابی / Failure events ═══════════════ */
  applyFailureEvent(key: string, scheduled: boolean) {
    const ev = FAILURE_EVENTS.find((e) => e.key === key)!;
    // طوفان با هشدار قبلی زمین نصف می‌شود
    const shielded = ev.special === "storm" && this.flag("stormWarned");
    const targets = shielded ? ev.targets.slice(0, 0) : ev.targets;
    let didDamage = false;
    targets.forEach((t) => {
      if (this.systems.get(t as SystemKey).state === "online") didDamage = true;
      this.systems.damage(t as SystemKey);
      if (t === "oxygen") this.leakActive = true;
    });
    // اگر همه‌ی اهداف از قبل خراب بوده‌اند، ضربه‌ی روحی خیلی کمتر است
    const moodMul = (shielded ? 0.4 : 1) * (didDamage ? 1 : 0.35);
    this.crewMgr.addMoodAll(-Math.round(ev.moodHit * moodMul));
    this.sound(shielded || !didDamage ? "bad" : "alarm");

    if (!didDamage && !shielded) {
      this.log("warn", `«${ev.fa}» — اما سیستم‌ها از قبل از کار افتاده بودند؛ آسیب تازه‌ای وارد نشد.`);
      return;
    }
    const sysNames = targets.map((t) => SYSTEM_FA[t]).join(" و ") || "هیچ‌کدام (سپر فعال بود)";
    this.log("bad", `${scheduled ? "☄ رویداد: " : "⚡ "}«${ev.fa}» — آسیب به: ${sysNames}`);
    if (shielded) this.log("good", "هشدار قبلی زمین سپر دفاعی را فعال کرد؛ ایستگاه در امان ماند.");

    switch (ev.special) {
      case "fire":
        this.resources.add("energy", -10);
        if (Math.random() < 0.3) {
          const victim = pick(this.crewMgr.alive());
          this.crewMgr.injure(victim.id, this.tick + 90);
          this.log("bad", `${victim.name} در آتش دچار سوختگی شد.`);
        }
        break;
      case "alien":
        this.resources.add("food", -8);
        if (this.crewMgr.countByDuty("security") > 0) {
          this.log("good", "افسران امنیتی موجودات را به بیرون راندند؛ تلفات محدود ماند.");
        } else {
          this.log("warn", "بدون افسر امنیتی، موجودات یک‌سوم انبار غذا را بردند و رفتند.");
        }
        break;
      case "storm":
        if (!shielded) this.resources.add("energy", -15);
        break;
      case "computer":
        this.order = clamp(this.order - 5);
        this.log("warn", "کامپیوتر مرکزی داده‌های پراکنده‌ای از «دریچه‌ی ۳» زمزمه می‌کند…");
        break;
    }
    if (ev.extraDrain) this.log("warn", "تلفات منابع تا زمان تعمیر ادامه خواهد داشت.");
  }

  /* ═══════════════ تعمیرات / Repairs ═══════════════
     سرعت تعمیر = پایه ÷ کارایی خدمه.
     کارایی از روحیه و اکسیژن می‌آید — قلب زنجیره‌ی بحران:
     اکسیژن کم → روحیه کم → تعمیر کند → خرابی بیشتر. */
  effMult() {
    const mood = this.crewMgr.avgMood();
    const o2 = this.resources.values.oxygen;
    let m = 0.55 + mood / 220;
    if (o2 < 30) m -= 0.15;
    if (o2 < 10) m *= 0.6;
    m += this.expSys.techBonus;
    return clamp(m, 0.35, 1.5);
  }
  private progressRepairs() {
    this.systems.systems.forEach((s) => {
      if (s.state !== "repairing") return;
      const crewFactor = s.crewAssigned.some((id) => {
        const c = this.crewMgr.crew.find((x) => x.id === id);
        return c && c.duty === "engineer";
      }) ? 1.25 : 1;
      s.repairProgress += (this.effMult() * crewFactor) / s.repairTotal;
      if (s.repairProgress >= 1) {
        s.state = "online"; s.repairProgress = 1;
        if (s.key === "oxygen") this.leakActive = false;
        s.crewAssigned.forEach((id) => {
          const c = this.crewMgr.crew.find((x) => x.id === id);
          if (c && c.status === "repairing") c.status = "idle";
        });
        s.crewAssigned = [];
        this.log("good", `✔ سیستم «${s.fa}» تعمیر شد و دوباره آنلاین است.`);
        this.sound("good");
      }
    });
  }
  startRepair(key: SystemKey) {
    const chk = this.systems.canRepair(key, this.crewMgr);
    if (!chk.ok || !chk.team) { this.log("warn", chk.reason ?? ""); return; }
    const s = this.systems.get(key);
    const total = Math.round(REPAIR_BASE_TICKS / 1); // زمان پایه؛ سرعت واقعی را effMult می‌سازد
    s.state = "repairing"; s.repairTotal = total; s.repairProgress = 0;
    s.crewAssigned = chk.team.map((c) => c.id);
    chk.team.forEach((c) => { c.status = "repairing"; c.busyUntil = this.tick + total; });
    const hrs = Math.round((total / (this.effMult() * 5)) * 10) / 10;
    this.log("info", `تیم تعمیر (${chk.team.map((c) => c.name).join("، ")}) روی «${s.fa}» کار می‌کند — حدود ${hrs} ساعت با کارایی فعلی.`);
    this.sound("blip");
  }

  /* ═══════════════ رویدادهای روزانه / Daily update ═══════════════ */
  private dailyUpdate() {
    const r = this.resources.values;
    const security = this.crewMgr.countByDuty("security");
    const medic = this.crewMgr.countByDuty("medic");

    // ── drift روحیه بر اساس نیازها (طبق قانون: تأمین نشدن → روحیه ↓) ──
    let moodDelta = 3 + RATION_MOOD[this.ration];
    if (r.food < 20) moodDelta -= 6;
    if (r.water < 20) moodDelta -= 6;
    if (r.oxygen < 30) moodDelta -= 6; else if (r.oxygen < 50) moodDelta -= 3;
    if (r.energy < 20) moodDelta -= 3;
    if (!this.systems.isOnline("heating")) moodDelta -= 4;
    if (medic > 0) moodDelta += 3; // حضور پزشک دل‌گرمی می‌آورد
    this.crewMgr.addMoodAll(moodDelta);

    // ── خودکشی: روحیه‌ی زیر ۲۵ خطرناک است (احتمال با عمق بحران مقیاس می‌گیرد
    //    تا آبشار مرگ ناگهانی نشود) ──
    this.crewMgr.alive().forEach((c) => {
      if (c.mood < 25) {
        const p = SUICIDE_CHANCE * ((25 - c.mood) / 25);
        if (Math.random() < p) {
          this.crewMgr.kill(c.id);
          this.crewMgr.addMoodAll(-10);
          this.order = clamp(this.order - 6);
          this.log("bad", `✖ ${c.name} دیگر نتوانست تحمل کند. ایستگاه یک نفر را از دست داد.`);
          this.sound("bad");
        }
      }
    });

    // ── نظم: فرسایش طبیعی + اثر افسران امنیتی ──
    this.order = clamp(this.order - 1 + Math.min(4, security * 2));

    // ── خرابکاری وقتی روحیه‌ی میانگین فرو ریخته (حلقه‌ی بازخورد تاریک) ──
    if (this.crewMgr.avgMood() < 30) {
      const chance = 0.1 + (this.flag("mutinySeed") ? 0.1 : 0);
      if (Math.random() < chance) {
        const online = this.systems.systems.filter((s) => s.state === "online");
        if (online.length) {
          const target = pick(online);
          this.systems.damage(target.key);
          this.log("bad", `☠ خرابکاری! کسی عمداً «${target.fa}» را از کار انداخت.`);
          this.sound("alarm");
        }
      }
    }

    // ── شورش: نظم زیر آستانه = سقوط ایستگاه ──
    if (this.order < 25 && this.order > MUTINY_ORDER_FLOOR) {
      this.log("warn", "⚠ زمزمه‌ی شورش در راهروها می‌پیچد. نظم را بالا ببرید!");
    }
    if (this.order <= MUTINY_ORDER_FLOOR) {
      this.finishEnding("dark", "شورش", [
        "درهای انبار شکستند و آژیرها در هیاهو گم شدند.",
        "خدمه‌ای که روزی به شما سلام نظامی می‌دادند، حالا مشعل‌های جوشکاری بالا گرفته‌اند.",
        "AVICENNA-7 دیگر فرمانده ندارد؛ فقط یک سیاه‌چالِ فلزی است",
        "که با دوازده روح سرگردان به دور زمین می‌چرخد.",
      ]);
      return;
    }

    // ── پیام رمزگذاری‌شده‌ی زمین (هر MESSAGE_EVERY_DAYS روز) ──
    if (this.day % MESSAGE_EVERY_DAYS === 0 && this.day > 1) {
      if (this.systems.isOnline("comms")) {
        this.msgSys.arrive(this.day);
        this.log("sys", `✉ پیام رمزگذاری‌شده از زمین دریافت شد. برای رمزگشایی: message  (کلید: ${this.expSys.keys})`);
        this.sound("msg");
      } else {
        this.log("warn", "✉ سیگنالی از زمین رسید اما ارتباطات خراب است — پیام از دست رفت.");
      }
    }

    // ── ظهور شیء ناشناخته در روزهای مشخص ──
    if (OBJECT_DAYS.includes(this.day)) {
      this.expSys.spawnObject(this.day);
      const o = this.expSys.activeObject();
      if (o) {
        this.log("story", `◈ سنسورها شیء ناشناخته‌ای شناسایی کردند: «${o.name}» — ${o.desc}`);
        this.log("info", `می‌توانید تیم اکتشاف بفرستید: explore [2-4]  (مهلت تا روز ${o.expiresDay})`);
        this.sound("mystery");
      }
    }

    // ── انقضای اشیاء اکتشافی ──
    this.expSys.objects.forEach((o) => {
      if (!o.resolved && this.day > o.expiresDay) {
        o.resolved = true;
        this.log("sys", `شیء «${o.name}» از محدوده‌ی ایستگاه خارج شد.`);
      }
    });

    // ── رویداد خرابی داستانی روز ──
    if (SCHEDULED_FAILURES[this.day] && !this.flag(`did_${SCHEDULED_FAILURES[this.day]}_${this.day}`)) {
      this.setFlag(`did_${SCHEDULED_FAILURES[this.day]}_${this.day}`, true);
      this.applyFailureEvent(SCHEDULED_FAILURES[this.day], true);
    }

    // ── پرده‌برداری‌های پنهان سناریوها ──
    if (typeof this.flag("lieKept") === "number" && this.flag("lieKept") === this.day && Math.random() < 0.35) {
      this.crewMgr.addMoodAll(-15); this.order = clamp(this.order - 10);
      this.log("bad", "دروغ لو رفت؛ خدمه فایل بایگانی را پیدا کردند. اعتماد فرو ریخت.");
    }
    if (this.flag("hiddenRation") === this.day && Math.random() < 0.4) {
      this.order = clamp(this.order - 12);
      this.log("bad", "خدمه فهمیدند جیره‌ها پنهانی نصف شده بود. بی‌اعتمادی گسترش یافت.");
    }
  }

  /* ═══════════════ مرگ با منابع صفر ═══════════════ */
  private checkResourceDeaths() {
    const r = this.resources.values;
    const alive = this.crewMgr.alive();
    if (!alive.length) return;
    if (r.oxygen <= 0 && this.tick - (this.flag("lastSuffocation") as number) > 12) {
      this.setFlag("lastSuffocation", this.tick);
      const v = pick(alive); this.crewMgr.kill(v.id); this.crewMgr.addMoodAll(-12);
      this.log("bad", `✖ ${v.name} خفه شد. اکسیژن صفر است!`); this.sound("bad");
    }
    if (r.water <= 0 && this.tick - (this.flag("lastDehydration") as number) > 20) {
      this.setFlag("lastDehydration", this.tick);
      const v = pick(alive); this.crewMgr.kill(v.id); this.crewMgr.addMoodAll(-10);
      this.log("bad", `✖ ${v.name} از تشنگی جان باخت.`); this.sound("bad");
    }
    if (r.food <= 0 && this.tick - (this.flag("lastStarvation") as number) > 30) {
      this.setFlag("lastStarvation", this.tick);
      const v = pick(alive); this.crewMgr.kill(v.id); this.crewMgr.addMoodAll(-10);
      this.log("bad", `✖ ${v.name} از گرسنگی جان باخت.`); this.sound("bad");
    }
  }

  /* ═══════════════ سناریوهای اخلاقی / Moral scenarios ═══════════════ */
  private openScenario(s: Scenario) {
    this.moralSys.mark(s.id);
    this.activeScenario = s;
    this.scenarioActive = true;
    this.log("story", `◈ تصمیم فرمانده لازم است: «${s.title}»`);
    this.sound("mystery");
    this.emit();
  }
  chooseOption(idx: number) {
    const s = this.activeScenario;
    if (!s) return;
    this.decisionsMade++;
    if (s.id === 99) { this.resolveFinalChoice(idx); return; }
    const opt = s.options[idx];
    this.crewMgr.addMoodAll(opt.morale);
    this.order = clamp(this.order + opt.order);
    this.survivalBonus = clamp(this.survivalBonus + opt.survival, -40, 40);
    this.log("info", `► تصمیم: ${opt.label}`);
    this.log("sys", `اثر → روحیه ${opt.morale >= 0 ? "+" : ""}${opt.morale} | نظم ${opt.order >= 0 ? "+" : ""}${opt.order} | بقا ${opt.survival >= 0 ? "+" : ""}${opt.survival}`);
    if (opt.special) this.applySpecial(opt.special);
    this.activeScenario = null;
    this.scenarioActive = false;
    this.sound("blip");
    this.emit();
  }

  /** اثرات ویژه‌ی گزینه‌ها — هر کلید یک اتفاق ملموس در جهان بازی است */
  private applySpecial(key: string) {
    switch (key) {
      case "add2crew": {
        const names = ["بازمانده‌ی ۱", "بازمانده‌ی ۲"];
        names.forEach((n, i) => this.crewMgr.crew.push({
          id: 100 + i, name: n, role: "مسافر", duty: "rest",
          mood: 42, status: "idle", busyUntil: 0, injuredUntil: 0, onMission: false,
        }));
        this.log("story", "دو بازمانده وارد ایستگاه شدند؛ حالا ۲ دهان بیشتر غذا می‌خورد.");
        break;
      }
      case "podSupplies":
        this.resources.add("food", 6); this.resources.add("oxygen", 4);
        this.log("sys", "از کپسول: ۶ واحد غذا و ۴ واحد اکسیژن برداشت شد."); break;
      case "food-25":
        this.resources.values.food *= 0.75;
        this.log("warn", "۲۵٪ از انبار غذا معدوم شد."); break;
      case "hiddenRation": this.setFlag("hiddenRation", this.day + 3); break;
      case "purifyFood":
        this.resources.add("energy", -8);
        this.log("sys", "پاک‌سازی با اشعه: ۸ واحد انرژی مصرف شد؛ غذا سالم ماند."); break;
      case "medicRest":
        this.crewMgr.crew.forEach((c) => { if (c.status === "injured") c.injuredUntil += 120; });
        this.crewMgr.addMoodAll(4);
        this.log("sys", "پزشک استراحت می‌کند؛ بهبود مجروحان کندتر شد اما دل‌ها گرم‌تر."); break;
      case "medicStrain": {
        const medic = this.crewMgr.crew.find((c) => c.role === "پزشک" && c.status !== "dead");
        if (medic) medic.mood = clamp(medic.mood - 25);
        this.crewMgr.crew.forEach((c) => { if (c.status === "injured") { c.status = "idle"; c.injuredUntil = 0; } });
        this.log("sys", "پزشک با دارو سر پا ماند و مجروحان درمان شدند؛ اما چشمانش دیگر سو ندارد."); break;
      }
      case "medicGamble":
        if (Math.random() < 0.5) {
          this.crewMgr.crew.forEach((c) => { if (c.status === "injured") { c.status = "idle"; c.injuredUntil = 0; } });
          this.log("good", "داروی آزمایشی گرفت! مجروحان سر پا شدند.");
        } else {
          const medic = this.crewMgr.crew.find((c) => c.role === "پزشک" && c.status !== "dead");
          if (medic) { this.crewMgr.kill(medic.id); this.crewMgr.addMoodAll(-12); this.log("bad", `دارو جواب نداد؛ ${medic.name} از دست رفت.`); this.sound("bad"); }
        }
        break;
      case "artifact+1":
        this.expSys.artifacts++;
        this.log("story", `موجود زنده ماند. چیزی در حرکاتش… آشناست. [مصنوعات بیگانه: ${this.expSys.artifacts}]`);
        if (Math.random() < 0.25) {
          const v = pick(this.crewMgr.alive());
          this.crewMgr.injure(v.id, this.tick + 60);
          this.log("warn", `${v.name} هنگام مطالعه‌ی موجود زخمی شد.`);
        }
        break;
      case "alienJettison":
        this.expSys.artifacts = Math.max(0, this.expSys.artifacts - 1);
        this.log("sys", "موجود از دریچه‌ی باری بیرون رفت. ایستگاه نفس راحتی کشید… یا شاید نکشید."); break;
      case "alienRelease":
        if (Math.random() < 0.3) { this.expSys.keys++; this.log("good", `موجود پیش از رفتن الگویی روی شیشه کشید؛ انگار یک «کلید» بود. [کلیدها: ${this.expSys.keys}]`); }
        else this.log("story", "موجود در سکوت از دریچه بیرون رفت؛ برای همیشه نگاه‌تان نکرد.");
        break;
      case "brig":
        this.crewMgr.alive().slice(0, 2).forEach((c) => (c.mood = clamp(c.mood - 10)));
        this.log("sys", "سلول انضباطی پر شد. سکوت سنگینی راهروها را گرفت."); break;
      case "mutinySeed": this.setFlag("mutinySeed", true); break;
      case "key+2":
        this.expSys.keys += 2;
        this.log("good", "ضبط سیگنال دو کلید رمزگشایی ساخت. [کلیدها: " + this.expSys.keys + "]"); break;
      case "purgeSignal":
        this.expSys.artifacts = Math.max(0, this.expSys.artifacts - 1);
        this.log("sys", "حافظه پاک شد؛ اما تا هفته‌ها کسی نتوانست بخوابد."); break;
      case "openAirlock":
        this.resources.add("oxygen", -15);
        this.expSys.artifacts++;
        this.log("bad", "دریچه ۳ باز شد؛ هوای بخش C به فضا ریخت. چیزی وارد شد… یا چیزی بیرون رفت؟");
        if (Math.random() < 0.3) {
          const v = pick(this.crewMgr.alive());
          this.crewMgr.injure(v.id, this.tick + 80);
          this.log("bad", `${v.name} در فشارِ ناگهانی آسیب دید.`);
        }
        break;
      case "volunteerDies": {
        const pool = this.crewMgr.alive();
        if (pool.length) {
          const v = pick(pool);
          this.crewMgr.kill(v.id);
          this.crewMgr.addMoodAll(-8);
          this.log("story", `${v.name} داوطلب شد. ده دقیقه بعد شیر بسته شد. او نه.`);
          this.sound("bad");
        }
        break;
      }
      case "reactorDelay":
        this.systems.damage("engine");
        this.resources.add("energy", -10);
        this.log("warn", "تعمیر عقب افتاد؛ موتور زیر فشار آسیب دید."); break;
      case "commanderBrave":
        this.setFlag("commanderBrave", true);
        this.crewMgr.addMoodAll(8);
        this.resources.add("energy", -5);
        this.log("story", "خودتان رفتید. وقتی برگشتید، هیچ‌کس جرئت نکرد مستقیم نگاه‌تان کند."); break;
      case "abandonInjured":
        this.crewMgr.crew.filter((c) => c.status === "injured").forEach((c) => this.crewMgr.kill(c.id));
        this.log("bad", "مجروحان در بخش قرنطینه تنها ماندند. درها قفل شدند."); break;
      case "leakOrder": this.order = clamp(this.order - 5); break;
      case "podLottery": {
        const pool = this.crewMgr.alive();
        for (let i = 0; i < 2 && pool.length; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          const v = pool.splice(idx, 1)[0];
          this.crewMgr.kill(v.id);
        }
        this.log("story", "قرعه کشیده شد؛ کپسول با دو نفر جدا شد. شاید زمین ببیندشان."); break;
      }
      case "podHeal":
        this.crewMgr.crew.forEach((c) => { if (c.status === "injured") { c.status = "idle"; c.injuredUntil = 0; c.mood = clamp(c.mood + 5); } });
        this.log("good", "کپسول پزشکی اعزام شد؛ مجروحان درمان شدند و برگشتند."); break;
      case "truthRevealed":
        this.order = clamp(this.order - 4);
        this.log("story", "حقیقت بلندگوی ایستگاه شد. گریه‌ها تمام شد؛ حالا همه فقط کار می‌کنند."); break;
      case "lieKept": this.setFlag("lieKept", this.day + 2); break;
      case "officersOnly": this.survivalBonus = clamp(this.survivalBonus + 4, -40, 40); break;
    }
  }

  /* ═══════════════ اکتشاف / Exploration ═══════════════ */
  tryExplore(n: number) {
    if (this.expSys.mission) { this.log("warn", "تیم قبلی هنوز در فضا است؛ صبر کنید."); return; }
    if (this.crewMgr.avgMood() < 25) {
      this.log("warn", "خدمه وحشت‌زده‌تر از آن‌اند که به دل تاریکی بروند — اول روحیه را بالا ببرید (جیره‌ی زیاد، پزشک، خواب).");
      return;
    }
    const obj = this.expSys.activeObject();
    if (!obj) { this.log("warn", "شیئی برای اکتشاف در محدوده نیست. سنسورها در حال اسکن‌اند…"); return; }
    if (!this.systems.isOnline("engine")) { this.log("warn", "موتور خراب است — بدون رانش، سفینه‌ای بلند نمی‌شود."); return; }
    if (this.expSys.shuttleDamaged) { this.log("warn", "سفینه‌ی کوچک آسیب‌دیده است؛ یک مهندس آزاد با «repair engine» بدنه را جوش می‌دهد."); return; }
    if (n < 2 || n > 4) { this.log("warn", "تیم اکتشاف باید ۲ تا ۴ نفر باشد."); return; }
    if (this.resources.values.fuel < FUEL_PER_LAUNCH) { this.log("warn", `سوخت کافی نیست — ${FUEL_PER_LAUNCH} واحد لازم است.`); return; }
    const team = this.crewMgr.pickExplorers(n);
    if (team.length < n) { this.log("warn", `فقط ${team.length} خدمه‌ی آزاد در دسترس است.`); return; }

    this.resources.add("fuel", -FUEL_PER_LAUNCH);
    team.forEach((c) => { c.status = "exploring"; c.onMission = true; });
    obj.resolved = true;
    // زمان پرواز: ۳ ساعت بازی ≈ ۱۵ تیک
    this.expSys.launch(team, obj.name, this.tick + 15);
    this.log("info", `🚀 تیم ${team.map((c) => c.name).join("، ")} به‌سوی «${obj.name}» پرتاب شد. بازگشت ~۳ ساعت دیگر.`);
    this.sound("blip");
  }

  private resolveMission() {
    const m = this.expSys.mission!;
    const outcome = this.expSys.rollOutcome();
    const team = m.crewIds.map((id) => this.crewMgr.crew.find((c) => c.id === id)!).filter(Boolean);
    this.expSys.mission = null;

    switch (outcome) {
      case "success": {
        const fuel = Math.round(rand(10, 20)), food = Math.round(rand(8, 16)), water = Math.round(rand(4, 10));
        this.resources.add("fuel", fuel); this.resources.add("food", food); this.resources.add("water", water);
        let extra = `سوخت +${fuel} | غذا +${food} | آب +${water}`;
        if (Math.random() < 0.35) { this.expSys.keys++; extra += " | 🔑 کلید رمزگشایی"; }
        if (Math.random() < 0.3) { this.expSys.techBonus = Math.min(0.45, this.expSys.techBonus + 0.15); extra += " | فناوری: تعمیر سریع‌تر شد"; }
        if (this.expSys.shuttleDamaged) { this.expSys.shuttleDamaged = false; extra += " | سفینه تعمیر شد"; }
        this.crewMgr.addMoodAll(6);
        this.log("good", `✔ اکتشاف «${m.objectName}» موفق بود — ${extra}`);
        this.sound("good");
        break;
      }
      case "danger": {
        this.expSys.shuttleDamaged = true;
        const v = team[Math.floor(Math.random() * team.length)];
        if (v) { this.crewMgr.injure(v.id, this.tick + 100); this.log("bad", `${v.name} در بازگشت اضطراری زخمی شد.`); }
        this.crewMgr.addMoodAll(-8);
        this.log("warn", `⚠ اکتشاف «${m.objectName}» خطرناک بود — سفینه آسیب دید و تیم به‌سختی برگشت.`);
        this.sound("bad");
        break;
      }
      case "catastrophe": {
        team.forEach((c) => this.crewMgr.kill(c.id));
        this.crewMgr.addMoodAll(-15);
        this.order = clamp(this.order - 10);
        this.log("bad", `☄ فاجعه: «${m.objectName}» تیم را بلعید. ${team.map((c) => c.name).join("، ")} برنگشتند.`);
        this.sound("alarm");
        break;
      }
      case "mystery": {
        this.expSys.artifacts++;
        this.expSys.keys += 2;
        this.crewMgr.addMoodAll(-4);
        this.log("story", `◈ «${m.objectName}» هیچ‌چیز نبود… و همه‌چیز. تیم با دو کلید و یک سؤال برگشت: [مصنوعات: ${this.expSys.artifacts}/${MYSTERY_ARTIFACTS}]`);
        if (this.expSys.artifacts >= MYSTERY_ARTIFACTS)
          this.log("story", "◈ سیگنالِ اعماق واضح‌تر شد… فرمان «jump» روی کنسول چشمک می‌زند.");
        this.sound("mystery");
        break;
      }
    }
    team.forEach((c) => { if (c.status !== "dead" && c.status !== "injured") { c.status = "idle"; c.onMission = false; } });
  }

  /* ═══════════════ فرمان‌ها / Command parsing ═══════════════ */
  handleCommand(raw: string) {
    const input = raw.trim();
    if (!input) return;
    // هنگام سناریو فقط اعداد ۱ تا ۳ (یا 1-3) پذیرفته می‌شود
    if (this.scenarioActive) {
      const map: Record<string, number> = { "1": 0, "2": 1, "3": 2, "۱": 0, "۲": 1, "۳": 2 };
      if (input in map) { this.chooseOption(map[input]); return; }
      this.log("warn", "زمان متوقف است؛ با عدد ۱ تا ۳ یکی از گزینه‌ها را انتخاب کنید.");
      return;
    }
    if (this.phase === "ending") {
      if (input === "restart") this.restart();
      else this.log("sys", "مأموریت تمام شده است. «restart» برای شروع دوباره.");
      return;
    }

    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1); // آرگومان‌ها دست‌نخورده می‌مانند (نام‌های فارسی)
    switch (cmd) {
      case "help": HELP_LINES.forEach((l) => this.log("sys", l)); break;
      case "status": this.cmdStatus(); break;
      case "crew": this.cmdCrew(); break;
      case "assign": this.cmdAssign(args); break;
      case "repair": this.cmdRepair(args); break;
      case "explore": this.tryExplore(parseInt(args[0] ?? "0", 10)); break;
      case "message": case "messages": this.cmdMessage(); break;
      case "rations": this.cmdRations(args[0]); break;
      case "sleep": this.cmdSleep(); break;
      case "pause": this.paused = true; this.log("sys", "⏸ زمان متوقف شد."); break;
      case "resume": this.paused = false; this.log("sys", "▶ زمان جریان یافت."); break;
      case "restart": this.restart(); break;
      case "clear": this.logs = []; break;
      case "sound": this.soundOn = !this.soundOn; this.log("sys", this.soundOn ? "🔊 صدا روشن شد." : "🔇 صدا خاموش شد."); break;
      case "scan": case "objects": this.cmdScan(); break;
      case "jump": this.cmdJump(); break;
      default: this.log("warn", `فرمان ناشناخته: «${cmd}» — فهرست فرمان‌ها: help`);
    }
    this.emit();
  }

  private cmdStatus() {
    const r = this.resources.values;
    this.log("sys", "────── گزارش وضعیت AVICENNA-7 ──────");
    (Object.keys(r) as ResourceKey[]).forEach((k) =>
      this.log("info", `  ${k.padEnd(7, " ")} : ${Math.round(r[k])}/100`));
    this.log("info", `  روحیه‌ی میانگین: ${Math.round(this.crewMgr.avgMood())} | نظم: ${Math.round(this.order)} | شانس بقا: ${this.survival()}٪`);
    this.log("info", `  جیره: ${RATION_FA[this.ration]} | کلیدها: ${this.expSys.keys} | مصنوعات: ${this.expSys.artifacts}/${MYSTERY_ARTIFACTS}`);
    this.log("info", `  سیستم‌ها: ${this.systems.systems.map((s) => `${s.en}:${s.state === "online" ? "OK" : s.state === "repairing" ? Math.round(s.repairProgress * 100) + "%" : "DOWN"}`).join("  ")}`);
    this.log("sys", "────────────────────────────────────");
  }
  private cmdCrew() {
    this.log("sys", "────── فهرست خدمه ──────");
    this.crewMgr.crew.forEach((c) => {
      const state = c.status === "dead" ? "مرده" : c.status === "injured" ? "مجروح"
        : c.status === "repairing" ? "در تعمیر" : c.status === "exploring" ? "در مأموریت" : "آزاد";
      this.log(c.status === "dead" ? "bad" : "info",
        `  [${String(c.id).padStart(2)}] ${c.name.padEnd(12, " ")} ${c.role.padEnd(10, " ")} وظیفه: ${c.duty.padEnd(9, " ")} روحیه: ${Math.round(c.mood)} — ${state}`);
    });
  }
  private cmdAssign(args: string[]) {
    const duties = ["engineer", "medic", "security", "scientist", "cook", "explorer", "rest"];
    const id = parseInt(args[0] ?? "", 10);
    const duty = (args[1] ?? "").toLowerCase();
    // جست‌وجو با شماره یا نام (حتی ناقص): assign 3 cook یا assign سارا cook
    const c = Number.isNaN(id)
      ? this.crewMgr.crew.find((x) => x.name.includes(args[0] ?? "§"))
      : this.crewMgr.crew.find((x) => x.id === id);
    if (!c) { this.log("warn", "خدمه‌ای با این شماره/نام نیست — فهرست: crew"); return; }
    if (c.status === "dead") { this.log("bad", "…او دیگر نیست."); return; }
    if (!duty || !duties.includes(duty)) { this.log("warn", `وظیفه‌ی نامعتبر. گزینه‌ها: ${duties.join(" | ")}`); return; }
    if (c.status === "repairing" || c.status === "exploring") { this.log("warn", `${c.name} الان مشغول است.`); return; }
    c.duty = duty as CrewMember["duty"];
    const offSpec = duty !== "rest" && DUTY_FA[duty] !== c.role;
    this.log("info", `${c.name} → وظیفه‌ی جدید: ${duty}${offSpec ? " (خارج از تخصص؛ کارایی کمتر)" : ""}`);
    this.sound("blip");
  }
  private cmdRepair(args: string[]) {
    const keys: SystemKey[] = ["oxygen", "electrical", "comms", "heating", "engine"];
    // نام‌های فارسی سیستم‌ها هم پذیرفته می‌شود
    const faMap: Record<string, SystemKey> = {
      "اکسیژن": "oxygen", "الکترونیک": "electrical", "ارتباطات": "comms",
      "گرمایش": "heating", "موتور": "engine",
    };
    const raw = (args[0] ?? "").toLowerCase();
    const k = (faMap[args[0] ?? ""] ?? raw) as SystemKey;
    if (!k || !keys.includes(k)) { this.log("warn", `سیستم نامعتبر. گزینه‌ها: ${keys.join(" | ")} (یا نام فارسی)`); return; }
    if (this.expSys.shuttleDamaged && k === "engine" && this.systems.isOnline("engine")) {
      // وقتی موتور اصلی سالم است اما سفینه‌ی کوچک آسیب دیده، مهندس آزاد تعمیرش می‌کند
      const eng = this.crewMgr.idle().find((c) => c.duty === "engineer");
      if (eng) {
        this.expSys.shuttleDamaged = false;
        eng.status = "repairing"; eng.busyUntil = this.tick + 25;
        this.log("good", `${eng.name} در حال جوشکاری بدنه‌ی سفینه‌ی کوچک است… (~۵ ساعت)`);
      } else this.log("warn", "مهندس آزادی برای تعمیر سفینه نیست.");
      return;
    }
    this.startRepair(k);
  }
  private cmdMessage() {
    const latest = this.msgSys.undecoded().pop() ?? this.msgSys.latest();
    if (!latest) { this.log("warn", "هنوز پیامی از زمین نرسیده است."); return; }
    this.log("sys", `آخرین پیام (روز ${latest.day}) — رمز: ${latest.encrypted}`);
    if (latest.decoded) { this.log("info", `(قبلاً رمزگشایی شده) متن: ${latest.plaintext}`); return; }
    if (this.expSys.keys <= 0) { this.log("warn", "کلید رمزگشایی ندارید — از اکتشاف‌های موفق به دست می‌آید."); return; }
    this.expSys.keys--; this.keysUsed++;
    latest.decoded = true;
    const text = caesarDecrypt(latest.encrypted);
    this.log("good", `رمزگشایی شد (سزار −۳): «${text}»`);
    switch (latest.effect) {
      case "stormWarn": this.setFlag("stormWarned", true); this.log("sys", "سپر طوفان خورشیدی فعال شد؛ اثر طوفان بعدی نصف می‌شود."); break;
      case "supplyHint": this.expSys.successBonus += 8; this.log("sys", "مختصات ذخایر دریافت شد؛ شانس اکتشاف موفق بالا رفت."); break;
      case "ordersComply": this.order = clamp(this.order + 5); this.crewMgr.addMoodAll(-3); break;
      case "diagnostic": this.expSys.techBonus = Math.min(0.45, this.expSys.techBonus + 0.05); break;
      case "rescueInfo": this.survivalBonus = clamp(this.survivalBonus + 4, -40, 40); this.log("sys", "امید در دل خدمه جوانه زد."); break;
      case "delayWarn": this.survivalBonus = clamp(this.survivalBonus - 3, -40, 40); break;
    }
    this.sound("msg");
  }
  private cmdRations(arg?: string) {
    const map: Record<string, RationLevel> = {
      low: "low", medium: "medium", high: "high",
      "کم": "low", "متوسط": "medium", "زیاد": "high",
    };
    const level = map[(arg ?? "").toLowerCase()];
    if (!level) { this.log("warn", "سطح جیره: low | medium | high  (یا کم/متوسط/زیاد)"); return; }
    if (level === "high" && this.resources.values.food < 20) {
      this.log("warn", "غذای کافی برای جیره‌ی زیاد نیست — روی «متوسط» قفل شد.");
      this.ration = "medium"; return;
    }
    this.ration = level;
    this.log("info", `جیره‌ی غذایی: ${RATION_FA[level]} — ${level === "low" ? "شکم‌ها گرسنه می‌ماند اما انبار دیرتر خالی می‌شود." : level === "high" ? "روحیه بالا می‌رود اما انبار سریع‌تر آب می‌شود." : "تعادل برقرار است."}`);
  }
  private cmdSleep() {
    if (this.scenarioActive) { this.log("warn", "تا تصمیم نگیرید، زمان نمی‌گذرد."); return; }
    if (this.paused) { this.log("warn", "زمان متوقف است؛ اول «resume»."); return; }
    this.log("sys", `چراغ‌ها کم‌نور شد… ${SLEEP_GAME_HOURS} ساعت می‌گذرد.`);
    const ticks = (SLEEP_GAME_HOURS * 60) / MIN_PER_TICK; // 60 تیک
    for (let i = 0; i < ticks; i++) {
      this.advance();
      if (this.scenarioActive || this.phase !== "playing") break;
    }
    this.crewMgr.addMoodAll(3);
    if (this.phase === "playing" && !this.scenarioActive) this.log("good", "خدمه کمی خوابیدند. روحیه +۳.");
    this.emit();
  }
  private cmdScan() {
    const o = this.expSys.activeObject();
    if (!o) { this.log("sys", "سنسورها: محدوده خالی است. اشیاء معمولاً هر چند روز یک‌بار سر و کله‌شان پیدا می‌شود."); return; }
    this.log("story", `◈ هدف فعال: «${o.name}» — ${o.desc} (مهلت: روز ${o.expiresDay})`);
    this.log("info", "اعزام تیم: explore [2-4]");
  }
  private cmdJump() {
    if (this.expSys.artifacts < MYSTERY_ARTIFACTS) {
      this.log("sys", "کنسول پاسخ می‌دهد: «مختصات ناقص است.» به " + (MYSTERY_ARTIFACTS - this.expSys.artifacts) + " مصنوعات دیگر نیاز دارید.");
      return;
    }
    this.finishEnding("mysterious", "پرش", [
      "سه مصنوعات را کنار هم گذاشتید؛ بدون اینکه به کسی بگویید چه کرده‌اید.",
      "نور از پنجره‌ها عقب کشید. ستاره‌ها مثل رنگِ خیس در هم حل شدند.",
      "آخرین ورودی گزارش: «ما ناپدید نشدیم. جابه‌جا شدیم.»",
      "AVICENNA-7 دیگر در هیچ مداری نیست — اما گاهی، رادیوی زمین",
      "ملودی‌ای ناشناخته می‌شنود که انگار از جایی خیلی دور لبخند می‌زند.",
    ]);
  }

  /* ═══════════════ شانس بقا / Survival chance ═══════════════ */
  survival() {
    const r = this.resources.values;
    const avg = (r.oxygen + r.energy + r.water + r.food + r.fuel) / 5;
    const sys = (this.systems.onlineCount() / 5) * 100;
    const s = 0.4 * avg + 0.2 * sys + 0.2 * this.order + 0.2 * this.crewMgr.avgMood() + this.survivalBonus;
    return Math.round(clamp(s, 2, 97));
  }

  /* ═══════════════ صحنه‌ی نهایی و پایان‌ها / Final scene ═══════════════ */
  private openFinalScene() {
    const alive = this.crewMgr.alive().length;
    this.log("story", "── روز ۳۰ — رادارها سفینه‌ای را نشان می‌دهند: «هم‌وند». لحظه‌ی انتخاب. ──");
    const options: Scenario["options"] = [
      {
        label: "همه به سکوی پهلوگیری؛ سوار بر هم‌وند شوید",
        morale: 0, order: 0, survival: 0, special: "finalEvac",
      },
      this.expSys.artifacts >= MYSTERY_ARTIFACTS
        ? { label: "پاسخ به سیگنال؛ ایستگاه را به ناشناخته بسپارید", morale: 0, order: 0, survival: 0, special: "finalJump" }
        : { label: "با سوختِ باقی‌مانده سیگنال تقویتی بفرستید (۲۵ سوخت)", morale: 0, order: 0, survival: 0, special: "finalBoost" },
      { label: "بمانید و ایستگاه را تا آخرین نفس سرِ پا نگه دارید", morale: 0, order: 0, survival: 0, special: "finalStay" },
    ];
    this.activeScenario = {
      id: 99, day: FINAL_DAY, title: "روزِ سی‌ام",
      text: alive === this.crewMgr.crew.length
        ? "همه‌ی خدمه زنده‌اند. هم‌وند نزدیک می‌شود؛ اما دک‌کلمپ‌های قدیمی ممکن است دستی آزاد بخواهند… و چیزی در اعماق ایستگاه هنوز منتظر است."
        : `از ${this.crewMgr.crew.length} نفر، ${alive} نفر مانده‌اند. هم‌وند نزدیک می‌شود. هر انتخابی قیمتی دارد.`,
      options,
    };
    this.scenarioActive = true;
    this.sound("mystery");
    this.emit();
  }
  private resolveFinalChoice(idx: number) {
    const choice = this.activeScenario?.options[idx].special ?? "finalEvac";
    this.decisionsMade++;
    this.activeScenario = null;
    this.scenarioActive = false;
    const alive = this.crewMgr.alive().length;
    const commsOk = this.systems.isOnline("comms");
    const engineOk = this.systems.isOnline("engine");
    const fuel = this.resources.values.fuel;
    const full = alive === this.crewMgr.crew.length;

    switch (choice) {
      case "finalJump":
        this.finishEnding("mysterious", "پرش", [
          "دقیقه‌ای که هم‌وند پهلو گرفت، شما سه مصنوعات را فعال کردید.",
          "خدمه می‌گویند صدایی شنیدند؛ انگار خود کهکشان نفس کشید.",
          "وقتی هم‌وند پنجره‌هایش را باز کرد، ایستگاه جای دیگری بود —",
          "نه در مدار زمین؛ جایی که ستاره‌ها اسم‌های دیگری دارند.",
        ]);
        return;
      case "finalBoost":
        if (fuel >= FUEL_TO_BROADCAST) {
          this.resources.add("fuel", -FUEL_TO_BROADCAST);
          const type: EndingType = full ? "heroic" : alive >= MIN_CREW_SACRIFICIAL ? "sacrificial" : "dark";
          const title = type === "heroic" ? "بازگشت" : type === "dark" ? "مدارِ اشتباه" : "بهای بازگشت";
          this.finishEnding(type, title, this.lines(type));
        } else {
          this.log("bad", "سوخت برای سیگنال تقویتی کافی نبود — هم‌وند مدار را اشتباه محاسبه کرد.");
          this.finishEnding("dark", "مدارِ اشتباه", this.lines("dark"));
        }
        return;
      case "finalStay": {
        const r = this.resources.values;
        const strong = (r.oxygen + r.energy + r.water + r.food) / 4 > 50 && this.systems.onlineCount() >= 4;
        if (full && strong) this.finishEnding("heroic", "ایستگاهِ ایستاده", this.lines("heroic"));
        else if (alive >= MIN_CREW_SACRIFICIAL) this.finishEnding("sacrificial", "آخرین فرمانده", this.lines("sacrificial"));
        else this.finishEnding("dark", "سقوطِ آرام", this.lines("dark"));
        return;
      }
      default: { // finalEvac
        if (full && commsOk && (engineOk || fuel >= 30)) {
          this.finishEnding("heroic", "بازگشت", this.lines("heroic"));
        } else if (alive >= MIN_CREW_SACRIFICIAL) {
          this.finishEnding("sacrificial", "بهای بازگشت", [
            "دک‌کلمپ‌ها گیر کردند. یک نفر باید می‌ماند و دستی آزادشان می‌کرد.",
            "شما قبل از اینکه کسی داوطلب شود، از دریچه رد شدید.",
            "از شیشه‌ی کوچکِ در، خدمه را دیدید که یکی‌یکی سوار می‌شوند.",
            "هم‌وند که جدا شد، ایستگاه مثل فانوسی خاموش در مدار ماند —",
            `اما ${alive} نفر، زنده، به سمت خانه برمی‌گردند.`,
          ]);
        } else {
          this.finishEnding("dark", "پهلویِ ناموفق", this.lines("dark"));
        }
      }
    }
  }
  private lines(type: EndingType): string[] {
    const alive = this.crewMgr.alive().length;
    switch (type) {
      case "heroic": return [
        "هم‌وند با دوازده صندلیِ پر از مدار جدا شد.",
        "هیچ‌کس حرف نزد؛ فقط صدای دستگاه اکسیژن بود و ضربان قلب‌ها.",
        "زمین می‌خواست مدال بدهد. شما فقط یک لیوان آب خواستید،",
        "و یک پنجره رو به آسمانِ آبی.",
      ];
      case "sacrificial": return [
        "آخرین ورودی گزارش فرمانده: «خدمه سوار شدند. ایستگاه را خاموش می‌کنم.»",
        `هر ${alive} بازمانده تا آخر عمر، موقع غذا خوردن یک صندلی خالی می‌گذاشتند.`,
      ];
      case "dark": return [
        "گزارش هم‌وند کوتاه بود: «به ایستگاه رسیدیم. درها باز بودند.",
        "هیچ‌کس نبود. فقط روی شیشه‌ی رصدخانه با بخارِ نفس نوشته بودند: ببخشید.»",
      ];
      case "mysterious": return [];
    }
  }
  private finishEnding(type: EndingType, title: string, lines: string[]) {
    if (this.phase === "ending") return;
    this.phase = "ending";
    if (this.timer) clearInterval(this.timer);
    const r = this.resources.values;
    this.ending = {
      type, title,
      lines: [ENDING_ART[type], "", ...lines],
      stats: [
        { label: "روزهای دوام", value: `${Math.min(this.day, FINAL_DAY)}/${FINAL_DAY}` },
        { label: "خدمه‌ی زنده", value: `${this.crewMgr.alive().length}/${this.crewMgr.crew.length}` },
        { label: "تصمیمات اخلاقی", value: `${this.decisionsMade}` },
        { label: "کلیدهای مصرفی", value: `${this.keysUsed}` },
        { label: "مصنوعات بیگانه", value: `${this.expSys.artifacts}` },
        { label: "میانگین منابع", value: `${Math.round((r.oxygen + r.energy + r.water + r.food + r.fuel) / 5)}٪` },
        { label: "سیستم‌های سالم", value: `${this.systems.onlineCount()}/5` },
        { label: "نظم نهایی", value: `${Math.round(this.order)}` },
      ],
    };
    this.sound(type === "dark" ? "alarm" : type === "mysterious" ? "mystery" : "good");
    this.emit();
  }
}

/* نمونه‌ی singleton برای کل اپ — یک موتور برای یک ترمینال */
export const engine = new GameEngine();
