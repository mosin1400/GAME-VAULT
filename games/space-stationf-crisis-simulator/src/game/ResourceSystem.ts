/**
 * ============================================================
 *  ResourceSystem — مدیریت ۵ منبع (اکسیژن، انرژی، آب، غذا، سوخت)
 * ============================================================
 *  قانون کاهش (هر DRAIN_INTERVAL ثانیه):
 *    ۱ واحد به ازای هر ۵ خدمه‌ی زنده × ضریب سیستم × DRAIN_SCALE
 *  تولید: خدمه‌ای که به وظایف تولیدی (scientist→O2, engineer→energy,
 *  cook→food) اختصاص داده شده‌اند، منبع تولید می‌کنند (بر اساس کارایی‌شان).
 */
import { CONFIG, clamp } from './types';
import type { RationLevel, ResourceKey, Resources } from './types';

export interface DrainContext {
  aliveCrew: number;
  activeSystems: number; // تعداد سیستم‌های سالم (۰-۵)
  broken: Record<string, boolean>; // کدام سیستم‌ها خراب‌اند
  rations: RationLevel;
  production: Partial<Record<ResourceKey, number>>; // تولید خدمه
}

export class ResourceSystem {
  values: Resources = { oxygen: 100, energy: 100, water: 100, food: 100, fuel: 100 };

  /** افزودن/کاستن مستقیم (با محدودسازی ۰..۱۰۰) */
  add(key: ResourceKey, amount: number) {
    this.values[key] = clamp(this.values[key] + amount);
  }

  get(key: ResourceKey) {
    return this.values[key];
  }

  /** ضریب سهمیه‌ی غذایی */
  static rationMultiplier(r: RationLevel) {
    return r === 'low' ? 0.6 : r === 'high' ? 1.5 : 1;
  }

  /**
   * یک چرخه‌ی کاهش. خروجی: مقدار خالص تغییر هر منبع (برای لاگ/دیباگ).
   * وابستگی‌ها:
   *  - سیستم اکسیژن خراب → نشت ۳ برابر
   *  - الکترونیک خراب → انرژی ۲ برابر مصرف
   *  - گرمایش خراب → آب یخ می‌زند (کاهش بیشتر) + سوخت برای گرمای اضطراری
   *  - موتور خراب → نشت سوخت
   */
  tickDrain(ctx: DrainContext): Partial<Record<ResourceKey, number>> {
    const base = (ctx.aliveCrew / 5) * CONFIG.DRAIN_SCALE; // قانون اصلی
    const sysFactor = Math.max(0.4, ctx.activeSystems / 5); // سیستم‌های فعال

    const delta: Record<ResourceKey, number> = {
      oxygen: -base * (ctx.broken.oxygen ? 3 : 1),
      energy: -base * sysFactor * (ctx.broken.electrical ? 2 : 1) * 1.1,
      water: -base * (ctx.broken.heating ? 1.6 : 1) * 0.9,
      food: -base * ResourceSystem.rationMultiplier(ctx.rations),
      fuel: -0.08 * (ctx.broken.engine ? 4 : 1) * (ctx.broken.heating ? 2 : 1),
    };

    // تولید خدمه
    for (const k of Object.keys(ctx.production) as ResourceKey[]) {
      delta[k] += ctx.production[k] ?? 0;
    }

    // بازیافت خودکار ایستگاه (ECLSS): آب و اکسیژن بازیافت می‌شوند
    // فقط وقتی انرژی کافی و شبکه‌ی برق سالم باشد → وابستگی انرژی→آب→روحیه
    if (this.values.energy > 30 && !ctx.broken.electrical) {
      delta.water += 0.3;
      if (!ctx.broken.oxygen) delta.oxygen += 0.12;
    } else if (this.values.energy > 10) {
      delta.water += 0.12; // حالت اضطراری
    }

    // انرژی صفر → بازیافت آب/اکسیژن کاملاً از کار می‌افتد (اثر آبشاری)
    if (this.values.energy <= 0) {
      delta.oxygen -= base * 0.8;
      delta.water -= base * 0.5;
    }

    for (const k of Object.keys(delta) as ResourceKey[]) this.add(k, delta[k]);
    return delta;
  }

  /** نوار پیشرفت ASCII: █ پر، ░ خالی */
  static bar(value: number, width = 20): string {
    const filled = Math.round((clamp(value) / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  }

  /** رنگ بر اساس سطح */
  static color(value: number): 'green' | 'yellow' | 'red' {
    return value > 50 ? 'green' : value > 25 ? 'yellow' : 'red';
  }

  /** آیا منبعی در سطح بحرانی است؟ */
  critical(): ResourceKey[] {
    return (Object.keys(this.values) as ResourceKey[]).filter((k) => this.values[k] < 20);
  }
}
