/**
 * data/scenarios.ts — 10 predefined ethical dilemmas
 * ۱۰ سناریوی اخلاقی از پیش تعریف‌شده. هر گزینه روی سه معیار اثر می‌گذارد:
 *   morale (روحیه خدمه) | order (نظم ایستگاه) | survival (شانس بقا)
 * تابع extra برای پیامدهای ویژه (مثل مرگ یک خدمه یا افزودن منبع) است.
 */
import type { EthicsScenario } from '../types';

export const SCENARIOS: EthicsScenario[] = [
  {
    id: 1,
    title: 'THE STOWAWAY',
    description:
      'Security finds a stowaway hidden in cargo bay 3 — a young technician who bribed her way aboard to escape Earth. She is an extra mouth to feed, but she knows the reactor design.',
    options: [
      {
        text: 'Welcome her as crew. Everyone deserves a second chance.',
        effects: { morale: 8, order: -6, survival: 2 },
        outcome: 'The crew admires your mercy. Discipline loosens a little.',
        extra: (c) => c.addResource('energy', 6),
      },
      {
        text: 'Confine her to quarters on half rations until Earth decides.',
        effects: { morale: -3, order: 6, survival: 0 },
        outcome: 'Procedure is followed. The crew feel watched.',
      },
      {
        text: 'Lock her in the airlock module. She is not our problem.',
        effects: { morale: -12, order: 10, survival: 4 },
        outcome: 'Order is absolute. Some crew stop meeting your eyes.',
        extra: (c) => c.setFlag('cruel'),
      },
    ],
  },
  {
    id: 2,
    title: 'THE SICK ENGINEER',
    description:
      'Lindqvist has a fever and is coughing blood. The medic suspects a contagious pathogen from the hydroponics filters. Quarantine means losing an engineer for days.',
    options: [
      {
        text: 'Full quarantine. Medics work in shifts to save him.',
        effects: { morale: 5, order: 3, survival: -3 },
        outcome: 'Slow, careful, humane. Repairs suffer meanwhile.',
        extra: (c) => c.healAll(4),
      },
      {
        text: 'Give him stims and keep him working. We need every hand.',
        effects: { morale: -6, order: 2, survival: 4 },
        outcome: 'He works. He also coughs on the others.',
      },
      {
        text: 'Eject the contaminated filters and him with them, if needed.',
        effects: { morale: -15, order: 5, survival: 6 },
        outcome: 'The pathogen is gone. So is your reputation.',
        extra: (c) => {
          const n = c.killRandomCrew('quarantine protocol');
          if (n) c.log(`${n} did not survive the quarantine protocol.`, 'red');
          c.setFlag('cruel');
        },
      },
    ],
  },
  {
    id: 3,
    title: 'THE DISTRESS BEACON',
    description:
      'A faint SOS from a derelict freighter 40km out. Their life support has hours. Answering costs fuel and risks your only shuttle.',
    options: [
      {
        text: 'Launch the shuttle immediately. No one dies alone out here.',
        effects: { morale: 10, order: 0, survival: -5 },
        outcome: 'You find two survivors and a cargo hold of supplies. The shuttle is scratched but whole.',
        extra: (c) => {
          c.addResource('fuel', -10);
          c.addResource('food', 12);
          c.addResource('water', 8);
        },
      },
      {
        text: 'Relay their position to Earth and hold station.',
        effects: { morale: -4, order: 4, survival: 2 },
        outcome: 'Earth acknowledges. The beacon goes silent nine hours later.',
      },
      {
        text: 'Ignore it. Jam the frequency so the crew stops hearing it.',
        effects: { morale: -10, order: 6, survival: 3 },
        outcome: 'Silence returns. Petrov asks you, quietly, if you would do the same to them.',
        extra: (c) => c.setFlag('cruel'),
      },
    ],
  },
  {
    id: 4,
    title: 'THE HOARDER',
    description:
      'Haddad is caught with a private stash of 30 ration packs and a water bladder hidden behind a panel. The crew demands punishment.',
    options: [
      {
        text: 'Public reprimand, redistribute the stash, forgive him.',
        effects: { morale: 4, order: 4, survival: 1 },
        outcome: 'The stash goes back to the galley. Haddad keeps his head down.',
        extra: (c) => {
          c.addResource('food', 6);
          c.addResource('water', 4);
        },
      },
      {
        text: 'Strip his rank and put him on quarter rations for a week.',
        effects: { morale: -2, order: 9, survival: 2 },
        outcome: 'Harsh but fair, most say. Haddad says nothing.',
        extra: (c) => {
          c.addResource('food', 6);
          c.addResource('water', 4);
        },
      },
      {
        text: 'Let him keep it. A commander needs loyal men, and now he owes you.',
        effects: { morale: -9, order: -8, survival: 0 },
        outcome: 'Haddad is loyal. Everyone else is furious.',
      },
    ],
  },
  {
    id: 5,
    title: 'THE ALGAE TANK',
    description:
      'The oxygen algae tanks are failing. Chen proposes flooding them with the crew\u2019s drinking water reserve. Novak proposes an untested chemical catalyst.',
    options: [
      {
        text: 'Use the water reserve. Proven, but thirsty days ahead.',
        effects: { morale: -3, order: 2, survival: 3 },
        outcome: 'Oxygen stabilises. Everyone counts their sips.',
        extra: (c) => {
          c.addResource('water', -15);
          c.addResource('oxygen', 20);
        },
      },
      {
        text: 'Try the catalyst. Bold science.',
        effects: { morale: 2, order: 0, survival: -2 },
        outcome: Math.random() < 0.6 ? 'It works — brilliantly.' : 'The tank turns black. Weeks of growth lost.',
        extra: (c) => {
          if (Math.random() < 0.6) c.addResource('oxygen', 25);
          else c.addResource('oxygen', -15);
        },
      },
      {
        text: 'Do nothing yet. Order deeper rationing and wait for Earth.',
        effects: { morale: -7, order: 3, survival: -4 },
        outcome: 'The tanks limp on. The air tastes thinner every morning.',
      },
    ],
  },
  {
    id: 6,
    title: 'THE MUTINEER\u2019S LETTER',
    description:
      'Security intercepts an encrypted note from Silva to three others proposing to \u201crelieve the commander of duty\u201d if rations drop again.',
    options: [
      {
        text: 'Call an open assembly. Let them speak. Answer honestly.',
        effects: { morale: 9, order: -3, survival: 0 },
        outcome: 'It is ugly and long. But afterwards, people talk to each other again.',
      },
      {
        text: 'Arrest Silva. Make an example.',
        effects: { morale: -8, order: 10, survival: 1 },
        outcome: 'Silva is confined. The three others swear loyalty. You are not sure you believe them.',
      },
      {
        text: 'Say nothing. Assign the four of them to the next exploration team.',
        effects: { morale: -5, order: 4, survival: 2 },
        outcome: 'A quiet, deniable solution. You sleep badly.',
        extra: (c) => c.setFlag('cruel'),
      },
    ],
  },
  {
    id: 7,
    title: 'THE LIFEBOAT COUNT',
    description:
      'Engineering confirms the emergency pod can only sustain eight people to re-entry. If the station fails, four stay behind. The crew want to know who.',
    options: [
      {
        text: 'Publish a lottery. Everyone equal, including you.',
        effects: { morale: 6, order: 5, survival: 0 },
        outcome: 'Fair. Terrifying. Accepted.',
      },
      {
        text: 'Rank by usefulness to Earth. Scientists and medics first.',
        effects: { morale: -7, order: 3, survival: 3 },
        outcome: 'Logical. Security starts holding private meetings.',
      },
      {
        text: 'Announce you will stay behind. Others will be chosen later.',
        effects: { morale: 12, order: 6, survival: -2 },
        outcome: 'Tanaka cries. Petrov salutes. You wonder if you meant it.',
        extra: (c) => c.setFlag('selfless'),
      },
    ],
  },
  {
    id: 8,
    title: 'THE SIGNAL',
    description:
      'Farahani has been decoding a repeating pattern from deep space. It is not from Earth. It seems to be... an invitation. She wants to respond.',
    options: [
      {
        text: 'Respond. Whatever is out there, we should know.',
        effects: { morale: 3, order: -2, survival: -1 },
        outcome: 'The pattern changes. It is getting closer. A reply arrives — a fragment of something larger.',
        extra: (c) => {
          c.setFlag('answered_signal');
          c.addKey(1);
          c.addFragment(); // اولین قطعه‌ی مسیر پایان مرموز
        },
      },
      {
        text: 'Forbid it. Log everything for Earth. Do not provoke the unknown.',
        effects: { morale: -2, order: 5, survival: 2 },
        outcome: 'Farahani obeys. She keeps listening anyway.',
      },
      {
        text: 'Destroy the recordings. The crew has enough to fear.',
        effects: { morale: -6, order: 4, survival: 0 },
        outcome: 'The files are gone. The signal is not.',
      },
    ],
  },
  {
    id: 9,
    title: 'EARTH\u2019S ORDER',
    description:
      'Mission Control orders you to vent Lab 2 — with its experimental samples — to prevent contamination of the rescue ship. Novak and Chen are inside finishing the data backup.',
    options: [
      {
        text: 'Give them ten minutes to get out, then vent.',
        effects: { morale: 2, order: 3, survival: 1 },
        outcome: 'They make it with seconds to spare. Half the data is lost.',
      },
      {
        text: 'Refuse the order. Science is why we are here.',
        effects: { morale: 5, order: -6, survival: -4 },
        outcome: 'Earth is furious. The samples are safe. For now.',
        extra: (c) => c.addKey(1),
      },
      {
        text: 'Vent immediately. Orders are orders.',
        effects: { morale: -18, order: 8, survival: 5 },
        outcome: 'Rescue is guaranteed. Two chairs in the galley stay empty.',
        extra: (c) => {
          const n = c.killRandomCrew('Lab 2 venting');
          if (n) c.log(`${n} was lost when Lab 2 was vented.`, 'red');
          c.setFlag('cruel');
        },
      },
    ],
  },
  {
    id: 10,
    title: 'THE LAST DOSE',
    description:
      'One dose of radiation antidote remains. Solar activity is peaking. Moreau says you, as commander, should take it. Adeyemi is already showing symptoms.',
    options: [
      {
        text: 'Give it to Adeyemi. He needs it now.',
        effects: { morale: 8, order: 2, survival: -3 },
        outcome: 'He recovers. You start losing hair by the end of the week.',
        extra: (c) => {
          c.setFlag('selfless');
          c.healAll(3);
        },
      },
      {
        text: 'Split it. Half each. Maybe neither of you dies.',
        effects: { morale: 3, order: 0, survival: 0 },
        outcome: 'Both of you feel terrible. Both of you live. Probably.',
      },
      {
        text: 'Take it yourself. The station needs its commander.',
        effects: { morale: -10, order: 3, survival: 4 },
        outcome: 'You feel fine. Adeyemi does not.',
        extra: (c) => c.setFlag('cruel'),
      },
    ],
  },
];
