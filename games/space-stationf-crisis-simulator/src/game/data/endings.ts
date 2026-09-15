/**
 * data/endings.ts — The four ending texts
 * متن چهار پایان‌بندی. هر خط یک سطر در ترمینال است.
 */
import type { EndingKey } from '../types';

export const ENDINGS: Record<EndingKey, { title: string; lines: string[] }> = {
  heroic: {
    title: '=== ENDING I : THE HEROIC RETURN ===',
    lines: [
      'Day 30. 06:12 station time.',
      'ARTEMIS locks onto the docking ring with a sound like a cathedral bell.',
      'Twelve faces crowd the airlock. Twelve. You count them twice.',
      'Petrov salutes. Chen hugs the rescue pilot. Tanaka finally sits down.',
      'You are the last to leave. You turn off the lights yourself.',
      '',
      'Nobody was left behind. Nobody was traded. Nobody was forgotten.',
      'History will call you a hero. You will remember mostly the smell of the algae tanks.',
      '',
      'STATION HELD. ALL HANDS ACCOUNTED FOR.',
    ],
  },
  sacrifice: {
    title: '=== ENDING II : THE COMMANDER STAYS ===',
    lines: [
      'Day 30. The docking clamps will not hold without manual override.',
      'Someone has to stay in the engine module and keep the pressure balanced.',
      'You do not let them vote. You already made your decision on Day 1.',
      '',
      'Through the porthole you watch ARTEMIS drift free, the crew pressed against the glass.',
      'Moreau is shouting something. You cannot hear it. You wave anyway.',
      'The station groans. The oxygen readout blinks red one last time.',
      '',
      'You open the last message from Earth. You never had the key.',
      'It does not matter now.',
      '',
      'CREW SURVIVED. COMMANDER LOST WITH STATION.',
    ],
  },
  dark: {
    title: '=== ENDING III : THE LONG FALL ===',
    lines: [
      'It does not happen all at once.',
      'First the arguments. Then the locked doors. Then the stolen rations.',
      'Then Haddad with the plasma cutter, and Petrov choosing a side.',
      '',
      'By the time ARTEMIS arrives there is no one to answer the hail.',
      'The station tumbles, half its modules dark, a slow cartwheel over the Pacific.',
      'The rescue crew find the logs. They find your final entry.',
      'It reads only: I should have listened.',
      '',
      'ORDER COLLAPSED. STATION LOST.',
    ],
  },
  mystery: {
    title: '=== ENDING IV : THE INVITATION ===',
    lines: [
      'Day 30. There is no ARTEMIS. There is no Earth on the radar.',
      'The three fragments you recovered fit together on the mess table like a key.',
      'Farahani reads it aloud. It is coordinates. It is a time. It is now.',
      '',
      'The black sphere is beside the station. It has always been beside the station.',
      'The crew do not panic. They look at you. They are waiting for an order.',
      'You give it.',
      '',
      'Mission Control logs the last telemetry at 03:41: all systems nominal, all crew aboard.',
      'Then nothing. No debris. No signal. No station.',
      'Just a very faint pattern, repeating, getting further away.',
      '',
      'STATION MISSING. CREW MISSING. SEARCH ONGOING.',
    ],
  },
};
