/**
 * ============================================================
 *  MessageSystem — پیام‌های رمزگذاری‌شده از زمین
 * ============================================================
 *  هر ۲ دقیقه یک پیام می‌رسد که با رمز سزار (شیفت ۳) رمزگذاری شده است.
 *  برای رمزگشایی یک «کلید» لازم است (از اکتشافات به دست می‌آید).
 *  اگر سیستم ارتباطات خراب باشد، پیام از دست می‌رود (لاگ می‌شود).
 */
import { CONFIG } from './types';
import type { EarthMessage } from './types';
import { EARTH_MESSAGES } from './data/messages';

export class MessageSystem {
  inbox: EarthMessage[] = [];
  keys = 0; // کلیدهای رمزگشایی موجود
  private nextIndex = 0;

  /** رمز سزار — حروف A-Z و ارقام 0-9 شیفت می‌خورند، بقیه دست‌نخورده */
  static caesar(text: string, shift: number): string {
    return text
      .toUpperCase()
      .split('')
      .map((ch) => {
        const c = ch.charCodeAt(0);
        if (c >= 65 && c <= 90) return String.fromCharCode(((c - 65 + shift + 26) % 26) + 65);
        if (c >= 48 && c <= 57) return String.fromCharCode(((c - 48 + shift + 10) % 10) + 48);
        return ch;
      })
      .join('');
  }

  /** دریافت پیام جدید (بر اساس روز). commsBroken → پیام مخدوش می‌شود */
  receive(day: number, commsBroken: boolean): EarthMessage | null {
    if (this.nextIndex >= EARTH_MESSAGES.length) this.nextIndex = 0; // چرخه در صورت طول کشیدن
    const src = EARTH_MESSAGES[this.nextIndex++];
    let plain = src.plain;
    if (commsBroken) {
      // بخش‌هایی از پیام با نویز جایگزین می‌شود
      plain = plain
        .split('')
        .map((ch) => (ch !== ' ' && Math.random() < 0.35 ? '#' : ch))
        .join('');
    }
    const msg: EarthMessage = {
      id: this.inbox.length + 1,
      day,
      plain,
      cipher: MessageSystem.caesar(plain, CONFIG.CAESAR_SHIFT),
      decrypted: false,
      kind: src.kind,
    };
    this.inbox.push(msg);
    return msg;
  }

  latest(): EarthMessage | null {
    return this.inbox.length ? this.inbox[this.inbox.length - 1] : null;
  }
  latestUndecrypted(): EarthMessage | null {
    for (let i = this.inbox.length - 1; i >= 0; i--) if (!this.inbox[i].decrypted) return this.inbox[i];
    return null;
  }

  /** مصرف یک کلید و رمزگشایی. برمی‌گرداند خطا یا null */
  decrypt(msg: EarthMessage): string | null {
    if (msg.decrypted) return 'Message already decrypted.';
    if (this.keys <= 0) return 'No decryption keys. Recover keys from exploration missions.';
    this.keys--;
    msg.decrypted = true;
    return null;
  }

  addKeys(n: number) {
    this.keys += n;
  }
}
