/**
 * ============================================================
 *  CrewSystem — مدیریت ۱۲ خدمه، روحیه، وظایف، کارایی و مرگ
 * ============================================================
 *  زنجیره‌ی علّی مهم:
 *   منابع کم → روحیه پایین → کارایی پایین → تعمیرات کندتر →
 *   خرابی بیشتر → منابع کمتر ... (حلقه‌ی فروپاشی)
 *  روحیه‌ی خیلی پایین → احتمال خودکشی؛ میانگین پایین → احتمال شورش.
 */
import { clamp, pick } from './types';
import type { CrewMember, CrewTask, Mood, RationLevel, ResourceKey, Resources } from './types';
import { createInitialCrew } from './data/crew';

export interface CrewDailyReport {
  starving: string[];
  thirsty: string[];
  suffocating: string[];
  deaths: { name: string; cause: string }[];
}

export class CrewSystem {
  members: CrewMember[] = createInitialCrew();

  // ---------- Queries / پرس‌وجو ----------
  alive() {
    return this.members.filter((m) => m.status !== 'dead');
  }
  aliveCount() {
    return this.alive().length;
  }
  /** خدمه‌ی در دسترس برای کار جدید (زنده، در ایستگاه، مشغول تعمیر نیست) */
  available() {
    return this.members.filter((m) => m.status === 'active' || m.status === 'injured');
  }
  find(name: string) {
    const n = name.toLowerCase();
    return this.members.find((m) => m.name.toLowerCase() === n || m.name.toLowerCase().startsWith(n));
  }
  byId(id: number) {
    return this.members.find((m) => m.id === id)!;
  }
  averageMorale() {
    const a = this.alive();
    return a.length ? a.reduce((s, m) => s + m.morale, 0) / a.length : 0;
  }

  /** تبدیل روحیه‌ی عددی به وضعیت روحی */
  static mood(m: CrewMember): Mood {
    if (m.morale >= 70) return 'optimistic';
    if (m.morale >= 40) return 'worried';
    if (m.morale >= 20) return 'nervous';
    return 'depressed';
  }

  /**
   * کارایی خدمه (۰.۳ تا ۱.۶):
   *  روحیه و سلامت کارایی پایه را می‌سازند؛ اگر وظیفه با تخصص یکی باشد ×۱.۵
   */
  static efficiency(m: CrewMember, forTask?: CrewTask): number {
    const base = 0.4 + (m.morale / 100) * 0.6; // 0.4..1.0
    const health = 0.5 + (m.health / 100) * 0.5; // 0.5..1.0
    const specialist = forTask && forTask === m.role ? 1.5 : 1;
    const injured = m.status === 'injured' ? 0.6 : 1;
    return +(base * health * specialist * injured).toFixed(2);
  }

  // ---------- Mutations / تغییرات ----------
  adjustMoraleAll(amount: number) {
    for (const m of this.alive()) m.morale = clamp(m.morale + amount);
  }
  healAll(amount: number) {
    for (const m of this.alive()) {
      m.health = clamp(m.health + amount);
      if (m.status === 'injured' && m.health > 60) m.status = 'active';
    }
  }
  assign(m: CrewMember, task: CrewTask) {
    m.task = task;
  }
  kill(m: CrewMember, cause: string) {
    m.status = 'dead';
    m.health = 0;
    m.deathCause = cause;
    m.task = 'idle';
    // مرگ همکار روحیه‌ی همه را می‌کاهد
    this.adjustMoraleAll(-6);
  }
  killRandom(cause: string, fromIds?: number[]): CrewMember | null {
    const pool = fromIds ? this.members.filter((m) => fromIds.includes(m.id) && m.status !== 'dead') : this.alive();
    if (!pool.length) return null;
    const v = pick(pool);
    this.kill(v, cause);
    return v;
  }
  injure(m: CrewMember, dmg: number) {
    m.health = clamp(m.health - dmg);
    if (m.health <= 0) this.kill(m, 'injuries');
    else if (m.health < 40) m.status = m.status === 'away' ? 'away' : 'injured';
  }

  // ---------- Production / تولید (هر ۱۰ ثانیه) ----------
  /**
   * محاسبه‌ی تولید منابع بر اساس وظایف. برمی‌گرداند:
   *  production: مقدار منبع تولیدشده
   *  healing / orderBoost: اثر پزشک و امنیت
   */
  production(brokenElectrical: boolean) {
    const prod: Partial<Record<ResourceKey, number>> = { oxygen: 0, energy: 0, food: 0, water: 0 };
    let healing = 0;
    let orderBoost = 0;
    let moraleBoost = 0;
    for (const m of this.members) {
      if (m.status !== 'active' && m.status !== 'injured') continue;
      const e = CrewSystem.efficiency(m, m.task);
      switch (m.task) {
        case 'scientist':
          prod.oxygen! += 0.2 * e; // جلبک/الکترولیز
          prod.water! += 0.06 * e; // بازیافت
          break;
        case 'engineer':
          prod.energy! += 0.3 * e * (brokenElectrical ? 0.5 : 1);
          break;
        case 'cook':
          prod.food! += 0.28 * e;
          moraleBoost += 0.05 * e;
          break;
        case 'medic':
          healing += 1.2 * e;
          moraleBoost += 0.07 * e;
          break;
        case 'security':
          orderBoost += 0.06 * e;
          break;
        default:
          break;
      }
    }
    return { prod, healing, orderBoost, moraleBoost };
  }

  /** اثر پیوسته‌ی محیط بر روحیه (هر ۱۰ ثانیه) */
  tickMorale(res: Resources, brokenCount: number, heatingBroken: boolean, rations: RationLevel, moraleBoost: number, healing: number) {
    for (const m of this.alive()) {
      let d = 0;
      if (res.oxygen < 30) d -= 0.6; // خفگی تدریجی
      if (res.oxygen < 15) d -= 1.0;
      if (res.food < 20) d -= 0.4;
      if (res.water < 20) d -= 0.4;
      if (res.energy < 15) d -= 0.3; // تاریکی
      if (heatingBroken) d -= 0.5; // سرما
      d -= brokenCount * 0.06; // هر خرابی استرس‌زاست
      if (rations === 'high') d += 0.15;
      if (rations === 'low') d -= 0.2;
      if (m.status === 'injured') d -= 0.2;
      d += moraleBoost;
      // بازیابی طبیعی: وقتی نیازهای پایه تأمین است، روحیه آرام‌آرام برمی‌گردد
      const basicsOk = res.oxygen > 40 && res.food > 30 && res.water > 30 && res.energy > 25;
      if (basicsOk) d += brokenCount === 0 ? 0.14 : 0.07;
      // روحیه‌ی خیلی بالا به‌سختی حفظ می‌شود
      if (m.morale > 85 && d > 0) d *= 0.4;
      m.morale = clamp(m.morale + d);

      // آسیب فیزیکی از کمبود منابع
      if (res.oxygen < 10) this.injure(m, 1.5);
      if (heatingBroken && res.energy < 20) this.injure(m, 0.5);
      // درمان پزشک
      if (healing > 0 && m.health < 100) m.health = clamp(m.health + healing / Math.max(1, this.aliveCount()) * 1.5);
      if (m.status === 'injured' && m.health >= 60) m.status = 'active';
    }
  }

  /**
   * بررسی روزانه‌ی نیازها. اگر منبع کافی نباشد: روحیه/سلامت ضربه می‌خورد.
   * برمی‌گرداند گزارشی برای لاگ.
   */
  dailyNeeds(res: Resources, rations: RationLevel): CrewDailyReport {
    const rep: CrewDailyReport = { starving: [], thirsty: [], suffocating: [], deaths: [] };
    const foodMult = rations === 'low' ? 0.6 : rations === 'high' ? 1.5 : 1;
    for (const m of this.alive()) {
      // نیاز روزانه‌ی خدمه با مقدار موجود مقایسه می‌شود (به‌صورت آستانه‌ای)
      if (res.food < m.needs.food * 5 * foodMult) {
        rep.starving.push(m.name);
        m.morale = clamp(m.morale - 12);
        m.health = clamp(m.health - 8);
      }
      if (res.water < m.needs.water * 5) {
        rep.thirsty.push(m.name);
        m.morale = clamp(m.morale - 10);
        m.health = clamp(m.health - 10);
      }
      if (res.oxygen < m.needs.oxygen * 8) {
        rep.suffocating.push(m.name);
        m.morale = clamp(m.morale - 8);
        m.health = clamp(m.health - 12);
      }
      if (m.health <= 0) {
        this.kill(m, 'deprivation');
        rep.deaths.push({ name: m.name, cause: 'deprivation' });
      }
    }
    return rep;
  }

  /**
   * بررسی خودکشی (هر دقیقه): روحیه < ۱۲ → ۴٪ احتمال؛ پزشک فعال آن را نصف می‌کند.
   */
  checkSuicide(hasMedic: boolean): CrewMember | null {
    for (const m of this.alive()) {
      if (m.morale < 12 && m.status !== 'away') {
        const chance = hasMedic ? 0.02 : 0.04;
        if (Math.random() < chance) {
          this.kill(m, 'took their own life');
          return m;
        }
      }
    }
    return null;
  }

  /** انتخاب تیم اکتشافی: اول explorer ها، سپس امنیتی، سپس بقیه‌ی سالم‌ها */
  pickExplorers(n: number): CrewMember[] {
    const pool = this.available().filter((m) => m.status === 'active');
    const sorted = [...pool].sort((a, b) => {
      const score = (m: CrewMember) => (m.task === 'explorer' ? 3 : m.role === 'security' ? 2 : 1) + m.health / 200;
      return score(b) - score(a);
    });
    return sorted.slice(0, n);
  }

  /** انتخاب تیم تعمیر: مهندسان با کارایی بالا اول */
  pickRepairers(n: number): CrewMember[] {
    const pool = this.available().filter((m) => m.status === 'active' || m.status === 'injured');
    const sorted = [...pool].sort((a, b) => CrewSystem.efficiency(b, 'engineer') - CrewSystem.efficiency(a, 'engineer'));
    return sorted.slice(0, n);
  }
}
