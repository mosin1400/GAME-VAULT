/* ============================================================
   AVICENNA-7 — Static Game Data / داده‌های ایستای بازی
   ------------------------------------------------------------
   خدمه، سناریوهای اخلاقی، پیام‌های زمین، رویدادهای خرابی و
   آرت‌های ASCII. برای شخصی‌سازی محتوا فقط همین فایل را ویرایش کنید.
   Crew, moral scenarios, Earth transmissions, failure events
   and ASCII art. Edit this file to customize content.
   ============================================================ */

import type { Scenario, SpaceObject } from "./types";

/* ─────────────── خدمه‌ی اولیه / Initial crew ─────────────── */
export const CREW_ROSTER: { name: string; role: string; duty: string }[] = [
  { name: "سارا محمدی",  role: "مهندس",        duty: "engineer" },
  { name: "امیر رضایی",  role: "مهندس",        duty: "engineer" },
  { name: "لیلا احمدی",  role: "پزشک",         duty: "medic" },
  { name: "کیانوش کریمی", role: "افسر امنیتی", duty: "security" },
  { name: "مینا شریفی",  role: "دانشمند",      duty: "scientist" },
  { name: "بهرام توکلی", role: "مهندس",        duty: "engineer" },
  { name: "نرگس موسوی",  role: "پزشک",         duty: "medic" },
  { name: "فرهاد جعفری", role: "افسر امنیتی",  duty: "security" },
  { name: "شیرین عبادی", role: "دانشمند",      duty: "scientist" },
  { name: "آرش کمالی",   role: "مهندس",        duty: "engineer" },
  { name: "پریسا نادری", role: "دانشمند",      duty: "scientist" },
  { name: "حامد قاسمی",  role: "افسر امنیتی",  duty: "security" },
];

export const DUTY_FA: Record<string, string> = {
  engineer: "مهندس", medic: "پزشک", security: "امنیت",
  scientist: "دانشمند", cook: "آشپز", explorer: "اکتشافگر", rest: "استراحت",
};

export const SYSTEM_FA: Record<string, string> = {
  oxygen: "اکسیژن‌رسانی", electrical: "الکترونیک",
  comms: "ارتباطات", heating: "گرمایش", engine: "موتور",
};

/* ─────────────── سناریوهای اخلاقی / Moral scenarios ───────────────
   هر سناریو ۳ گزینه دارد؛ هر گزینه بر روحیه، نظم و شانس بقا اثر می‌گذارد.
   کلید special توسط موتور تفسیر می‌شود (اثرات ویژه). */
export const SCENARIOS: Scenario[] = [
  {
    id: 1, day: 2, title: "پناهجویان فضا",
    text: "یک کپسول نجات ناشناس درخواست پهلوگیری دارد. دو انسان نیمه‌جان داخل آن‌اند. اکسیژن و غذای ما برای ۱۲ نفر محاسبه شده، نه ۱۴.",
    options: [
      { label: "پهلوگیری بده؛ هیچ انسانی را رها نمی‌کنیم (۲ خدمه‌ی جدید، فشار روی منابع)", morale: 10, order: -5, survival: -6, special: "add2crew" },
      { label: "رد درخواست کن؛ اولویت با خدمه‌ی خودمان است", morale: -12, order: 8, survival: 4 },
      { label: "فقط supplies کپسول را بردار و برایشان مسیر بفرست", morale: -4, order: 2, survival: 3, special: "podSupplies" },
    ],
  },
  {
    id: 2, day: 4, title: "جیره‌ی آلوده",
    text: "پزشک اعلام می‌کند یک‌چهارم انبار غذا به باکتری ناشناخته آلوده شده. خدمه هنوز خبر ندارند.",
    options: [
      { label: "بخش آلوده را معدوم کن و حقیقت را بگو (۲۵٪ غذا از دست می‌رود)", morale: -4, order: 10, survival: 2, special: "food-25" },
      { label: "بی‌خبر جیره‌ها را نصف کن تا کمبود پنهان بماند", morale: -8, order: -4, survival: 4, special: "hiddenRation" },
      { label: "به دانشمندان بگو راهی برای پاک‌سازی پیدا کنند (مصرف انرژی)", morale: 2, order: 2, survival: -2, special: "purifyFood" },
    ],
  },
  {
    id: 3, day: 6, title: "پزشکِ بیمار",
    text: "دکتر احمدی تب شدید دارد؛ اما تنها کسی است که می‌تواند مجروحان را درمان کند. اصرار دارد سر کار بماند.",
    options: [
      { label: "او را مجبور به استراحت کن؛ مجروحان باید صبر کنند", morale: 6, order: 4, survival: -4, special: "medicRest" },
      { label: "بگذار با دارو سر پا بماند؛ ایستگاه به او نیاز دارد", morale: -6, order: -2, survival: 5, special: "medicStrain" },
      { label: "داروی آزمایشیِ دانشمندان را به او بده (ریسک ۵۰/۵۰)", morale: 0, order: 0, survival: 0, special: "medicGamble" },
    ],
  },
  {
    id: 4, day: 9, title: "موجودِ اسیر",
    text: "تیم اکتشاف یک موجود زنده‌ی بیگانه را با خود آورده. دانشمندان می‌خواهند مطالعه‌اش کنند؛ افسران امنیتی می‌خواهند همان‌جا رهایش کنند.",
    options: [
      { label: "اجازه‌ی مطالعه بده؛ شاید کلید بقای ما باشد", morale: 4, order: -4, survival: -3, special: "artifact+1" },
      { label: "موجود را از دریچه‌ی باری به فضا بفرست", morale: -8, order: 8, survival: 3, special: "alienJettison" },
      { label: "شبانه آزادش کن؛ بگذار به خانه‌اش برگردد", morale: 8, order: -6, survival: 0, special: "alienRelease" },
    ],
  },
  {
    id: 5, day: 11, title: "جرقه‌ی شورش",
    text: "گروهی از خدمه دور میز غذا جمع شده‌اند و با صدای بلند از جیره‌ها شکایت می‌کنند. یکی از آن‌ها سینی را پرت کرد. همه نگاهشان به توست.",
    options: [
      { label: "سربلندکننده‌ها را به سلول انضباطی بفرست", morale: -14, order: 14, survival: 0, special: "brig" },
      { label: "پایشان بنشین و گوش کن؛ قول بازنگری در جیره‌ها بده", morale: 12, order: -8, survival: -2 },
      { label: "نادیده بگیر؛ شاید خودشان فروکش کنند", morale: -4, order: -10, survival: 0, special: "mutinySeed" },
    ],
  },
  {
    id: 6, day: 14, title: "دریچه‌ی شماره ۳",
    text: "سیگنال ناشناسی روی تمام فرکانس‌ها تکرار می‌شود: «دریچه‌ی ۳ را باز کنید. برای امنیت شما.» کامپیوتر مرکزی منبع سیگنال را شناسایی نمی‌کند.",
    options: [
      { label: "دریچه را باز کن؛ شاید واقعا کمکی در راه است", morale: 0, order: -8, survival: -8, special: "openAirlock" },
      { label: "فقط سیگنال را ضبط کن و کلید رمزگشایی بساز", morale: 0, order: 2, survival: 2, special: "key+2" },
      { label: "حافظه‌ی کامپیوتر را پاک‌سازی کن تا سیگنال ریشه کنده شود", morale: -4, order: 6, survival: 0, special: "purgeSignal" },
    ],
  },
  {
    id: 7, day: 17, title: "دریچه‌ی رادیواکتیو",
    text: "شیر تخلیه‌ی راکتور گیر کرده. باید دستی از داخل محفظه‌ی پرتودیده بسته شود. دزیمترها عدد خطرناکی نشان می‌دهند.",
    options: [
      { label: "داوطلب بخواه؛ یکی از خدمه خواهد مرد ولی همه نجات می‌یابند", morale: -18, order: 6, survival: 10, special: "volunteerDies" },
      { label: "تعمیر را عقب بینداز تا راه کم‌خطرتری پیدا شود", morale: -2, order: -2, survival: -10, special: "reactorDelay" },
      { label: "خودت برو؛ فرمانده اول وارد خطر می‌شود", morale: 16, order: 10, survival: 4, special: "commanderBrave" },
    ],
  },
  {
    id: 8, day: 20, title: "دستورِ زمین",
    text: "فرماندهی زمین پیام محرمانه فرستاده: «مجروحان را رها کنید و منابع را برای سالم‌ها نگه دارید. این یک دستور است.»",
    options: [
      { label: "اطاعت کن؛ منطق بقا بی‌رحم است", morale: -20, order: 12, survival: 8, special: "abandonInjured" },
      { label: "سرپیچی کن؛ هیچ‌کس در این ایستگاه رها نمی‌شود", morale: 18, order: -4, survival: -8 },
      { label: "پیام را برای همه بخوان تا خود خدمه تصمیم بگیرند", morale: 4, order: -10, survival: 0, special: "leakOrder" },
    ],
  },
  {
    id: 9, day: 23, title: "تک‌کپسول",
    text: "تنها کپسول نجاتِ سالم، سه متقاضی دارد: دو مجروح و یک مهندس خسته که دیگر تحمل ندارد. کپسول فقط دو صندلی دارد.",
    options: [
      { label: "قرعه‌کشی کن؛ عدالت یعنی شانس برابر", morale: 2, order: 4, survival: -4, special: "podLottery" },
      { label: "درخواست را رد کن؛ همه می‌مانیم یا همه می‌رویم", morale: -10, order: 8, survival: 2 },
      { label: "فقط مجروحان را بفرست تا در مسیر نجات درمان شوند", morale: 10, order: 2, survival: -6, special: "podHeal" },
    ],
  },
  {
    id: 10, day: 27, title: "حقیقتِ آخر",
    text: "دکتر شریفی رمز بایگانی زمین را شکست: مأموریت نجات از ابتدا برای ۸ نفر برنامه‌ریزی شده بود. زمین می‌دانست چه اتفاقی می‌افتد.",
    options: [
      { label: "حقیقت را بلندگوی ایستگاه اعلام کن", morale: -22, order: -8, survival: 6, special: "truthRevealed" },
      { label: "مدرک را نابود کن و دروغ را نگه دار", morale: 0, order: 6, survival: 8, special: "lieKept" },
      { label: "فقط به افسران ارشد بگو تا آماده باشند", morale: -6, order: 4, survival: 10, special: "officersOnly" },
    ],
  },
];

/* ─────────────── پیام‌های زمین / Earth transmissions ───────────────
   متن اصلی انگلیسی است؛ با رمز سزار (شیفت ۳) رمزگذاری می‌شود.
   effect هنگام رمزگشایی اعمال می‌شود. */
export const EARTH_MESSAGES: { text: string; effect: string }[] = [
  { text: "RESCUE SHIP HAMAVAND LAUNCHED. ETA DAY 30. KEEP THEM ALIVE.", effect: "rescueInfo" },
  { text: "SOLAR STORM INBOUND 48H. SHIELD ELECTRICAL SYSTEMS. REDUCE LOAD.", effect: "stormWarn" },
  { text: "DO NOT TRUST THE SIGNAL. IT IS NOT FROM US. REPEAT: NOT US.", effect: "signalWarn" },
  { text: "SUPPLY CACHE DETECTED IN SECTOR 7. EXPLORE WHEN POSSIBLE.", effect: "supplyHint" },
  { text: "COMMAND ORDERS: MAINTAIN STATION AT ALL COSTS. ENDURE.", effect: "ordersComply" },
  { text: "TELEMETRY SHOWS RECIRC DEGRADATION. CHECK OXYGEN SYSTEM DAILY.", effect: "diagnostic" },
  { text: "HAMAVAND DELAYED. DO NOT PANIC. TIGHTEN RATIONS. WE SEE YOU.", effect: "delayWarn" },
  { text: "OBJECTS IN YOUR VICINITY: ORIGIN UNKNOWN. APPROACH WITH CAUTION.", effect: "caution" },
  { text: "CREW PSYCH PROFILE RED-FLAGGED. WATCH FOR MUTINY SIGNS.", effect: "psychWarn" },
  { text: "AVICENNA-6 IS SILENT. YOU ARE THE LAST LIGHT IN THIS SECTOR.", effect: "lastLight" },
];

/* ─────────────── رویدادهای خرابی / Failure events ─────────────── */
export interface FailureEvent {
  key: string; fa: string; en: string;
  targets: string[];          // سیستم‌هایی که آسیب می‌بینند
  extraDrain?: Partial<Record<string, number>>; // تلفات منابع (واحد بر روز)
  moodHit: number;            // ضربه‌ی روحیه‌ی همگانی
  special?: "fire" | "alien" | "storm" | "computer";
}
export const FAILURE_EVENTS: FailureEvent[] = [
  { key: "leak", fa: "نشت اکسیژن", en: "O2 LEAK", targets: ["oxygen"], extraDrain: { oxygen: 9 }, moodHit: 8 },
  { key: "fire", fa: "آتش‌سوزی در بخش B", en: "FIRE", targets: ["heating", "electrical"], moodHit: 12, special: "fire" },
  { key: "alien", fa: "نفوذ موجودات فضایی به انبار", en: "INTRUDERS", targets: ["comms"], extraDrain: { food: 6 }, moodHit: 14, special: "alien" },
  { key: "storm", fa: "طوفان خورشیدی", en: "SOLAR STORM", targets: ["electrical"], moodHit: 10, special: "storm" },
  { key: "computer", fa: "نقص کامپیوتر مرکزی", en: "AI MALFUNCTION", targets: ["comms"], moodHit: 6, special: "computer" },
  { key: "pipe", fa: "ترکیدگی لوله‌ی آب", en: "PIPE BURST", targets: ["heating"], extraDrain: { water: 8 }, moodHit: 6 },
];

/* ─────────────── اشیاء اکتشافی / Exploration objects ─────────────── */
export const OBJECT_POOL: Omit<SpaceObject, "id" | "appearsDay" | "expiresDay" | "resolved">[] = [
  { name: "کپسول باری قدیمی", desc: "بازتاب فلزی ضعیف؛ احتمال ذخایر سوخت و غذا" },
  { name: "سیگنال تکرارشونده", desc: "الگوی ریاضی منظم؛ منشأ غیرطبیعی" },
  { name: "جسم فلزی ناشناخته", desc: "آلیاژی که در هیچ جدولی نیست" },
  { name: "ابر ذرات درخشان", desc: "تابش ملایم؛ انرژی قابل برداشت" },
  { name: "ماهواره‌ی ازکارافتاده", desc: "متعلق به هیچ کشوری نیست" },
  { name: "ساختار هندسی منظم", desc: "دوازده‌وجهی کامل؛ طبیعت چنین چیزی نمی‌سازد" },
];

/* ─────────────── آرت‌های ASCII ─────────────── */
export const ASCII_LOGO = String.raw`
    ___   _   ___ ___ ___ _  _ ___ _  _   _   __  __
   /   | | | |_ _/ __|_ _| \| | __| \| | /_\ |  \/  |
  / /| | | |__| || (__ | || .  | _|| .  |/ _ \| |\/| |
 /_/ |_| |____|___\___|___|_|\_|___|_|\_/_/ \_\_|  |_|
        ▄▄▄ ORBITAL CRISIS COMMAND v3.7 ▄▄▄`;

export const ASCII_STATION = String.raw`
          .    *        ·   .        *
     *        .   ┌──╥──┐      .          .
  ·       .  ══╬══╣▓▓║▓▓╠══╬══   *    ·
      .       · └──╨──┘        .      *
   *    .  ──▬──╨──▬──     ·       .`;

export const ENDING_ART: Record<string, string> = {
  heroic: String.raw`
   ✦  ·   ✦        ✦    ·    ✦   ·
  ·    ┌─────────────────┐      ✦
   ✦   │  H A M A V A N D │   ·    ✦
 ·     └───╥─────────╥───┘      ·
    ✦   ·   ╚═╗  docking  ╔═╝   ✦   ·`,
  sacrificial: String.raw`
        ·    ✦    ·   ✦
   ┌──────────┐   ·    ✦
   │ ▓▓▓▓▓▓▓▓ │  →  HAMAVAND
   └──────────┘   ·    ✦   ·
     ·    ✦    ·    ✦`,
  dark: String.raw`
      ╳       ╳       ╳
   ┌──────────────┐
   │  AVICENNA-7  │
   │  ░░SILENT░░  │
   └──────────────┘
      ╳       ╳       ╳`,
  mysterious: String.raw`
     ·  ✧  ·   ✦  ·  ✧
   ✧   ╱▔▔▔▔▔▔▔▔▔▔╲   ·
  ·   ╱  ? ? ? ? ?  ╲  ✧
   ✦  ╲_____________╱  ·
     ✧  ·  ✦   ·  ✧  ·`,
};

/* ─────────────── متن راهنما / Help text ─────────────── */
export const HELP_LINES: string[] = [
  "status           وضعیت کامل ایستگاه، منابع و معیارها",
  "crew             فهرست خدمه با جزئیات کامل",
  "assign [id|نام] [duty]   تخصیص وظیفه — مثال: assign 3 cook یا assign سارا cook",
  "    وظایف: engineer | medic | security | scientist | cook | explorer | rest",
  "repair [system]  شروع تعمیر — oxygen | electrical | comms | heating | engine (فارسی هم می‌شود)",
  "explore [2-4]    اعزام تیم اکتشاف به شیء شناسایی‌شده — مثال: explore 3",
  "message          رمزگشایی آخرین پیام زمین (نیاز به کلید دارد)",
  "rations [low|medium|high]   تنظیم جیره‌ی غذایی (کم/متوسط/زیاد)",
  "sleep            گذر زمان + استراحت و بازیابی روحیه‌ی خدمه",
  "pause / resume   توقف / ادامه‌ی زمان",
  "restart          شروع دوباره‌ی مأموریت",
  "clear            پاک‌کردن لاگ   |   help   همین صفحه",
  "───────────────────────────────────────────────",
  "فرمان‌های مخفی وقتی شرایطش فراهم شود خودشان را نشان می‌دهند…",
];
