/**
 * ansi.ts — نگاشت رنگ‌های ANSI به کلاس‌های CSS
 * معادل کدهای رنگ ترمینال (\x1b[32m ...) در مرورگر.
 */
import type { LogColor } from '../game/types';

export const ANSI: Record<LogColor, string> = {
  green: 'text-[#4ade80]',
  red: 'text-[#f87171]',
  yellow: 'text-[#facc15]',
  cyan: 'text-[#22d3ee]',
  magenta: 'text-[#e879f9]',
  white: 'text-[#e5e7eb]',
  gray: 'text-[#6b7280]',
  blue: 'text-[#60a5fa]',
};

export const ansi = (c?: LogColor) => ANSI[c ?? 'white'];
