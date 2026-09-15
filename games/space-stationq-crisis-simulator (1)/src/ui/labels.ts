/* ============================================================
   Labels — نگاشت وضعیت روحی و وظایف به برچسب فارسی
   ============================================================ */
import { MOOD_STATES } from "../game/constants";
export { DUTY_FA } from "../game/data";

/** وضعیت روحی بر اساس عدد ۰ تا ۱۰۰ */
export function MOOD_FA(mood: number) {
  return MOOD_STATES.find((s) => mood >= s.min) ?? MOOD_STATES[MOOD_STATES.length - 1];
}
