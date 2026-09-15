/**
 * data/messages.ts — Plain-text Earth transmissions
 * پیام‌های زمین (قبل از رمزگذاری). ترتیب = ترتیب دریافت.
 * kind: warning (هشدار) | order (دستور) | rescue (تیم نجات)
 */
import type { EarthMessage } from '../types';

export const EARTH_MESSAGES: Array<Pick<EarthMessage, 'plain' | 'kind'>> = [
  { kind: 'order', plain: 'MISSION CONTROL TO STATION. HOLD ORBIT 30 DAYS. RESCUE VESSEL ARTEMIS UNDER PREPARATION.' },
  { kind: 'warning', plain: 'SOLAR FLARE ACTIVITY RISING. EXPECT ELECTRICAL FAULTS. KEEP ENERGY RESERVES ABOVE 40.' },
  { kind: 'rescue', plain: 'ARTEMIS LAUNCH DELAYED. FUNDING DISPUTE. DO NOT INFORM CREW. MAINTAIN MORALE.' },
  { kind: 'warning', plain: 'MICROMETEOROID CLUSTER ON YOUR TRACK. HULL BREACH RISK ELEVATED FOR 48 HOURS.' },
  { kind: 'order', plain: 'PRIORITY: PRESERVE SCIENTIFIC DATA OVER NON-ESSENTIAL PERSONNEL. ACKNOWLEDGE.' },
  { kind: 'rescue', plain: 'ARTEMIS CREW SELECTED. ETA DAY 30 IF NO FURTHER DELAYS. HOLD ON COMMANDER.' },
  { kind: 'warning', plain: 'UNKNOWN OBJECTS NEAR YOUR ORBIT ARE NOT OURS. REPEAT. NOT OURS. AVOID CONTACT.' },
  { kind: 'order', plain: 'COMMANDER YOUR AUTHORITY IS CONFIRMED. ANY MUTINY IS TO BE SUPPRESSED BY ALL MEANS.' },
  { kind: 'rescue', plain: 'ARTEMIS CAN CARRY 12 PLUS COMMANDER ONLY IF FUEL ALLOWS. KEEP STATION FUEL ABOVE 20.' },
  { kind: 'warning', plain: 'DEEP SPACE SIGNAL CONFIRMED BY THREE OBSERVATORIES. SOURCE MOVING TOWARD YOU.' },
  { kind: 'order', plain: 'DO NOT RESPOND TO THE SIGNAL. DO NOT SEND TEAMS TO THE OBJECTS. THAT IS AN ORDER.' },
  { kind: 'rescue', plain: 'ARTEMIS EN ROUTE. DOCKING REQUIRES ENGINE ONLINE AND ORDER MAINTAINED. SEE YOU SOON.' },
  { kind: 'warning', plain: 'REACTOR TELEMETRY SHOWS FATIGUE. ASSIGN ENGINEERS TO ENERGY. FAILURE CASCADE POSSIBLE.' },
  { kind: 'rescue', plain: 'FINAL APPROACH DAY 30. IF WE LOSE CONTACT WE WILL STILL COME. HOLD THE LINE.' },
  { kind: 'order', plain: 'PSYCH EVAL FLAGS YOUR CREW. RECOMMEND HIGH RATIONS IF FOOD ALLOWS. MORALE IS SURVIVAL.' },
  { kind: 'warning', plain: 'HEATING LOSS AT YOUR ALTITUDE IS LETHAL WITHIN HOURS. REPAIR HEATING FIRST. ALWAYS.' },
  { kind: 'rescue', plain: 'ARTEMIS CREW SENDS REGARDS. THEY HAVE COFFEE. REAL COFFEE. THIRTY DAYS COMMANDER.' },
  { kind: 'warning', plain: 'THE SIGNAL SOURCE HAS STOPPED 900KM FROM YOU. WE DO NOT KNOW WHAT IT WANTS.' },
  { kind: 'order', plain: 'IF THE STATION CANNOT BE HELD, EVACUATE CREW TO POD. COMMANDER STAYS WITH DATA.' },
  { kind: 'rescue', plain: 'ARTEMIS VISUAL ON STATION. PREPARE FOR DOCKING. IT IS ALMOST OVER.' },
];

/** نام‌های تصادفی برای اشیای ناشناس */
export const OBJECT_NAMES = [
  'a tumbling cargo pod',
  'a dark, silent satellite',
  'a wreck with a Russian hull marking',
  'a cloud of glinting debris',
  'a perfectly smooth black sphere',
  'an ice fragment trailing vapour',
  'a derelict escape capsule',
  'a slowly rotating antenna array',
  'something that reflects no light',
  'a fuel tank with intact valves',
];
