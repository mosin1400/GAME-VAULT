/* ============================================================
   AVICENNA-7 — Tunable Constants / ثابت‌های قابل تنظیم
   ------------------------------------------------------------
   همه‌ی اعداد کلیدی بازی اینجاست تا بتوانید سختی، سرعت زمان و
   تعادل منابع را بدون دست‌زدن به منطق، شخصی‌سازی کنید.
   All key numbers live here so you can tune difficulty,
   time-scale and resource balance without touching the logic.
   ============================================================ */

// ── زمان / Time ──────────────────────────────────────────────
// هر روز بازی چند ثانیه‌ی واقعی طول بکشد (پیش‌فرض: ۲ دقیقه = ۱۲۰ ثانیه)
// How many real seconds one in-game day lasts (default: 2 minutes)
export const DAY_REAL_SECONDS = 120;

// فاصله‌ی تیک موتور بازی به میلی‌ثانیه
// Engine tick interval in milliseconds
export const TICK_MS = 1000;

// هر تیک چند دقیقه‌ی بازی را جلو می‌برد (۱۴۴۰ دقیقه در روز ÷ تعداد تیک‌ها)
// Game-minutes advanced per tick (1440 / ticks-per-day = 12)
export const MIN_PER_TICK = Math.round(1440 / ((DAY_REAL_SECONDS * 1000) / TICK_MS));

// فرمان sleep چند ساعت بازی را رد می‌کند (استراحت و بازیابی روحیه)
// How many in-game hours the `sleep` command skips (rest + small mood recovery)
export const SLEEP_GAME_HOURS = 12;

// ── منابع / Resources ────────────────────────────────────────
// فاصله‌ی چرخه‌ی مصرف منابع بر حسب تیک (۱۰ تیک ≈ ۱۰ ثانیه‌ی واقعی مطابق مشخصات)
// Resource drain cycle in ticks (10 ticks ≈ 10 real seconds, per spec)
export const DRAIN_TICKS = 10;

// مصرف پایه به ازای هر خدمه در هر چرخه (ضریب × تعداد زنده‌ها)
// Base consumption per crew member per cycle
export const CONSUME_PER_CREW = { o2: 0.2, water: 0.16, energy: 0.18, food: 0 } as const;

// بازیابی منابع وقتی سیستم‌ها سالم باشند (در هر چرخه)
// Regeneration per cycle when the corresponding system is healthy
export const REGEN = { o2: 2.9, water: 2.6, energyDay: 3.8, energyNight: 0.7 } as const;

// تولید غذای هیدروپونیک: به ازای هر دانشمندی که سر کار است (در هر چرخه ≈ ۴ واحد در روز)
// Hydroponic food output per assigned scientist per cycle (needs water > 15)
export const HYDROPONIC_PER_SCIENTIST = 0.35;

// مصرف غذا بر اساس سطح جیره در هر چرخه (برای ۱۲ نفر؛ با تعداد خدمه مقیاس می‌گیرد)
// Food drain per cycle by ration level (scaled by alive crew / 12)
// روزانه ≈ کم: ۱۱ | متوسط: ۱۸ | زیاد: ۲۴
export const RATION_DRAIN = { low: 0.9, medium: 1.5, high: 2.0 } as const;

// اثر جیره بر روحیه (در روز)
// Daily mood effect of each ration level
export const RATION_MOOD = { low: -6, medium: 0, high: +4 } as const;

// سوخت: مصرف رانشگرها در هر چرخه + هزینه‌ی هر پرواز اکتشافی
// Fuel: thruster burn per cycle + cost per exploration launch
export const FUEL_THRUSTER_PER_CYCLE = 0.12;
export const FUEL_PER_LAUNCH = 12;
export const FUEL_TO_BROADCAST = 25; // سوخت لازم برای پخش اضطراری وقتی ارتباطات خراب است

// ── خدمه / Crew ──────────────────────────────────────────────
export const INITIAL_CREW = 12;

// آستانه‌های وضعیت روحی (مقیاس ۰ تا ۱۰۰)
// Mood-state thresholds on a 0–100 scale
export const MOOD_STATES = [
  { min: 70, fa: "خوش‌بین", en: "OPTIMISTIC" },
  { min: 45, fa: "نگران",   en: "WORRIED" },
  { min: 25, fa: "عصبی",    en: "NERVOUS" },
  { min: 0,  fa: "افسرده",  en: "DEPRESSED" },
] as const;

// احتمال خودکشی روزانه وقتی روحیه‌ی فرد زیر ۲۵ باشد
// Daily suicide chance when an individual's mood drops below 25
export const SUICIDE_CHANCE = 0.15;

// ── خرابی‌ها / Failures ──────────────────────────────────────
// احتمال پایه‌ی خرابی تصادفی در هر ساعت بازی (هر ۵ تیک)
// با روز، روحیه‌ی پایین و کمبود مهندس تشدید می‌شود
// Base random-failure chance per in-game hour (checked every 5 ticks)
export const FAILURE_CHANCE_PER_HOUR = 0.025;

// زمان پایه‌ی تعمیر بر حسب تیک (۵۰ تیک ≈ ۱۰ ساعت بازی — مطابق «۱۰ واحد زمان»)
// Base repair time in ticks (50 ticks ≈ 10 in-game hours)
export const REPAIR_BASE_TICKS = 50;
export const REPAIR_CREW_NEEDED = 2; // تعداد خدمه‌ی لازم برای هر تعمیر

// ── پیام‌های زمین / Earth messages ────────────────────────────
// پیام هر چند روز یک‌بار می‌رسد (هر ۲ دقیقه‌ی واقعی = هر روز بازی)
// Days between encrypted transmissions (every game day = every 2 real minutes)
export const MESSAGE_EVERY_DAYS = 1;
export const CAESAR_SHIFT = 3; // شیفت رمز سزار / Caesar cipher shift

// ── اکتشاف / Exploration ─────────────────────────────────────
// جدول شانس نتایج اکتشاف (موفقیت / خطر / فاجعه / رمزآلود)
// Exploration outcome table (success / danger / catastrophe / mystery)
export const EXPLORE_ODDS = { success: 0.4, danger: 0.3, catastrophe: 0.2, mystery: 0.1 } as const;

// روزهای ظهور اشیاء ناشناخته (کمی تصادفی می‌شود)
// Days on which unidentified objects appear (jittered slightly)
export const OBJECT_DAYS = [3, 6, 9, 12, 15, 18, 21, 24, 27];

// ── پایان‌ها / Endings ────────────────────────────────────────
export const FINAL_DAY = 30;
export const HEROIC_NEEDS_ALL_ALIVE = true;
export const MIN_CREW_SACRIFICIAL = 6; // حداقل بازمانده برای پایان فداکارانه
export const MYSTERY_ARTIFACTS = 3;    // تعداد مصنوعات برای پایان مرموز
export const MUTINY_ORDER_FLOOR = 10;  // نظم زیر این عدد = شورش موفق
