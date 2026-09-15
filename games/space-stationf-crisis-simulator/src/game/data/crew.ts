/**
 * data/crew.ts — Initial 12 crew members
 * ۱۲ خدمه‌ی اولیه‌ی ایستگاه. نام، تخصص و روحیه‌ی اولیه را اینجا ویرایش کنید.
 */
import type { CrewMember } from '../types';

interface Seed {
  name: string;
  role: CrewMember['role'];
  morale: number;
}

const SEEDS: Seed[] = [
  { name: 'Vasquez', role: 'engineer', morale: 78 },
  { name: 'Okafor', role: 'engineer', morale: 72 },
  { name: 'Lindqvist', role: 'engineer', morale: 65 },
  { name: 'Tanaka', role: 'medic', morale: 80 },
  { name: 'Moreau', role: 'medic', morale: 70 },
  { name: 'Petrov', role: 'security', morale: 62 },
  { name: 'Adeyemi', role: 'security', morale: 68 },
  { name: 'Haddad', role: 'security', morale: 55 },
  { name: 'Chen', role: 'scientist', morale: 82 },
  { name: 'Novak', role: 'scientist', morale: 74 },
  { name: 'Farahani', role: 'scientist', morale: 77 },
  { name: 'Silva', role: 'scientist', morale: 60 },
];

/** خدمه به‌صورت پیش‌فرض روی تخصص خودشان کار می‌کنند */
export function createInitialCrew(): CrewMember[] {
  return SEEDS.map((s, i) => ({
    id: i + 1,
    name: s.name,
    role: s.role,
    task: s.role,
    morale: s.morale,
    health: 100,
    status: 'active',
    // نیاز روزانه: کمی تصادفی تا هر خدمه متفاوت باشد
    needs: {
      food: +(1.8 + Math.random() * 0.6).toFixed(1),
      water: +(2.0 + Math.random() * 0.6).toFixed(1),
      oxygen: +(2.2 + Math.random() * 0.5).toFixed(1),
    },
  }));
}
