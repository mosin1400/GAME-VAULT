/**
 * ============================================================
 *  GameEngine — هسته‌ی بازی: ساعت، تعامل سیستم‌ها، پردازش دستورات
 * ============================================================
 *  هر ثانیه‌ی واقعی = ۱ ثانیه‌ی بازی. هر روز = ۱۲۰ ثانیه.
 *  ترتیب هر tick:
 *    1. اگر دوراهی اخلاقی باز است → زمان متوقف
 *    2. هر ۱۰ ثانیه: تولید خدمه → کاهش منابع → روحیه → تعمیرات → نظم
 *    3. هر ۶۰ ثانیه: بررسی خرابی، خودکشی، شورش
 *    4. رویدادهای زمان‌بندی‌شده: پیام زمین، شیء ناشناس، بازگشت تیم اکتشاف
 *    5. مرز روز: نیازهای روزانه، آمار بقا/نظم، سناریوی اخلاقی
 *    6. شرایط پایان بازی
 */
import { CONFIG, TOTAL_SECONDS, RESOURCE_KEYS, CREW_TASKS, clamp } from './types';
import type {
  ConsoleLine,
  CrewTask,
  EndingKey,
  EthicsContext,
  EthicsScenario,
  GameSnapshot,
  LogColor,
  LogEntry,
  RationLevel,
  ResourceKey,
} from './types';
import { ResourceSystem } from './ResourceSystem';
import { CrewSystem } from './CrewSystem';
import { FailureSystem, FAILURE_DEFS } from './FailureSystem';
import { EthicsSystem } from './EthicsSystem';
import { MessageSystem } from './MessageSystem';
import { ExplorationSystem } from './ExplorationSystem';
import { EndingSystem } from './EndingSystem';

type Listener = () => void;

export class GameEngine {
  // ---- subsystems / زیرسیستم‌ها ----
  resources = new ResourceSystem();
  crew = new CrewSystem();
  failures = new FailureSystem();
  ethics = new EthicsSystem();
  messages = new MessageSystem();
  exploration = new ExplorationSystem();
  endings = new EndingSystem();

  // ---- global state / وضعیت کلی ----
  phase: GameSnapshot['phase'] = 'intro';
  time = 0; // ثانیه‌ی بازی
  order = 70; // نظم ایستگاه
  survival = 60; // شانس بقا
  rations: RationLevel = 'normal';
  fragments = 0;
  mutiny = false;
  stationLost = false;
  ending: EndingKey | null = null;
  endingText: string[] = [];
  sleeping = false;
  private zeroOxygenSeconds = 0;
  private mutinyWarned = false;

  log: LogEntry[] = [];
  console: ConsoleLine[] = [];
  private listeners = new Set<Listener>();

  // ============================================================
  //  Subscription / اشتراک برای رابط کاربری
  // ============================================================
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    for (const l of this.listeners) l();
  }

  // ============================================================
  //  Time helpers / کمکی‌های زمان
  // ============================================================
  get day() {
    return Math.min(CONFIG.TOTAL_DAYS, Math.floor(this.time / CONFIG.DAY_SECONDS) + 1);
  }
  /** ساعت شبیه‌سازی‌شده‌ی ایستگاه: ۱۲۰ ثانیه → ۲۴ ساعت */
  clock() {
    const frac = (this.time % CONFIG.DAY_SECONDS) / CONFIG.DAY_SECONDS;
    const mins = Math.floor(frac * 24 * 60);
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    return `${h}:${m}`;
  }
  private stamp() {
    return `D${String(this.day).padStart(2, '0')} ${this.clock()}`;
  }

  // ============================================================
  //  Output / خروجی
  // ============================================================
  addLog(text: string, color: LogColor = 'white') {
    this.log.push({ time: this.stamp(), text, color });
    if (this.log.length > 60) this.log.shift();
  }
  print(text = '', color?: LogColor) {
    this.console.push({ text, color });
    if (this.console.length > 300) this.console.shift();
  }
  private printLines(lines: string[], color?: LogColor) {
    for (const l of lines) this.print(l, color);
  }

  // ============================================================
  //  Lifecycle / چرخه‌ی عمر
  // ============================================================
  start() {
    this.phase = 'playing';
    this.console = [];
    this.printLines(
      [
        '╔══════════════════════════════════════════════════════════════╗',
        '║   ORBITAL STATION  K E P L E R - 7   //  COMMAND TERMINAL    ║',
        '╚══════════════════════════════════════════════════════════════╝',
        '',
        'Commander, the station is yours. Earth says 30 days until rescue.',
        'Twelve people are breathing your air. Systems are old. Nothing is certain.',
        '',
        'Type  help  to list commands.  Each day is 2 real minutes.',
        'Resources drain every 10s. Failures strike without warning.',
        '',
      ],
      'cyan',
    );
    this.addLog('Command handed over. Station Kepler-7 online.', 'cyan');
    this.addLog('Earth: rescue vessel ARTEMIS ETA 30 days.', 'blue');
    this.notify();
  }

  restart() {
    Object.assign(this, new GameEngine());
    this.start();
  }

  // ============================================================
  //  Main tick / تیک اصلی (هر ثانیه)
  // ============================================================
  tick() {
    if (this.phase !== 'playing') return;
    if (this.ethics.pending) return; // زمان با دوراهی باز متوقف است

    this.time++;
    const t = this.time;

    // ---- هر ۱۰ ثانیه: چرخه‌ی اقتصادی ----
    if (t % CONFIG.DRAIN_INTERVAL === 0) this.economyTick();

    // ---- هر ۶۰ ثانیه: خطرها ----
    if (t % CONFIG.FAILURE_CHECK_INTERVAL === 0) this.hazardTick();

    // ---- پیام زمین هر ۱۲۰ ثانیه (وسط روز) ----
    if (t % CONFIG.MESSAGE_INTERVAL === 60) this.receiveMessage();

    // ---- شیء ناشناس هر ۶۰۰ ثانیه ----
    if (t % CONFIG.EXPLORE_INTERVAL === 30) {
      const obj = this.exploration.detect();
      this.addLog(`Sensors: ${obj} detected nearby. (explore 2-4)`, 'magenta');
    }

    // ---- بازگشت تیم اکتشاف ----
    if (this.exploration.isDue(t)) this.resolveExpedition();

    // ---- مرز روز ----
    if (t % CONFIG.DAY_SECONDS === 0 && t < TOTAL_SECONDS) this.newDay();

    // ---- خفگی کامل ----
    if (this.resources.get('oxygen') <= 0) {
      this.zeroOxygenSeconds++;
      if (this.zeroOxygenSeconds % 20 === 0) {
        const v = this.crew.killRandom('asphyxiation');
        if (v) this.addLog(`${v.name} has stopped breathing.`, 'red');
      }
    } else this.zeroOxygenSeconds = 0;

    // ---- پایان بازی ----
    if (this.crew.aliveCount() === 0) {
      this.stationLost = true;
      this.finish();
    } else if (t >= TOTAL_SECONDS) this.finish();

    this.notify();
  }

  /** چرخه‌ی ۱۰ ثانیه‌ای: تولید → کاهش → روحیه → تعمیر → نظم */
  private economyTick() {
    const broken = this.failures.brokenMap();
    const { prod, healing, orderBoost, moraleBoost } = this.crew.production(broken.electrical);

    // انرژی کم → تولید اکسیژن/غذا کاهش (اثر آبشاری)
    if (this.resources.get('energy') < 15) {
      prod.oxygen = (prod.oxygen ?? 0) * 0.4;
      prod.food = (prod.food ?? 0) * 0.5;
    }

    this.resources.tickDrain({
      aliveCrew: this.crew.aliveCount(),
      activeSystems: this.failures.activeCount(),
      broken,
      rations: this.rations,
      production: prod,
    });

    const brokenN = this.failures.broken().length;
    this.crew.tickMorale(this.resources.values, brokenN, broken.heating, this.rations, moraleBoost, healing);

    // تعمیرات — کارایی تعمیرکار به روحیه/سلامت وابسته است
    const fixed = this.failures.tickRepairs(
      (id) => CrewSystem.efficiency(this.crew.byId(id), 'engineer'),
      this.resources.get('energy') < 10,
    );
    for (const s of fixed) {
      this.failures.releaseCrew(s, (id) => this.crew.byId(id));
      this.addLog(`${s.label} repaired and back online.`, 'green');
      this.crew.adjustMoraleAll(2);
    }

    const engineers = this.crew.members.filter((m) => m.task === 'engineer' && m.status === 'active').length;
    this.failures.tickIntegrity(engineers);
    this.exploration.tickShuttleRepair(engineers);

    // نظم: امنیت آن را بالا می‌برد؛ خرابی و روحیه‌ی پایین آن را می‌کاهد
    const avg = this.crew.averageMorale();
    let dOrder = orderBoost - brokenN * 0.06;
    if (avg < 35) dOrder -= 0.25;
    else if (avg > 65) dOrder += 0.05;
    if (this.rations === 'low') dOrder -= 0.05;
    this.order = clamp(this.order + dOrder);

    // هشدارهای منابع
    for (const k of this.resources.critical()) {
      if (Math.round(this.resources.get(k)) === 19 || Math.round(this.resources.get(k)) === 9)
        this.addLog(`WARNING: ${k.toUpperCase()} critical (${Math.round(this.resources.get(k))}%).`, 'red');
    }
  }

  /** چرخه‌ی ۶۰ ثانیه‌ای: خرابی، خودکشی، شورش */
  private hazardTick() {
    const ev = this.failures.maybeFail(this.time, this.resources.get('energy'));
    if (ev) {
      this.addLog(`!! ${ev.def.label} — ${this.failures.get(ev.system).label} OFFLINE`, ev.def.color);
      this.addLog(ev.def.text, ev.def.color);
      for (const k of Object.keys(ev.def.immediate) as ResourceKey[]) this.resources.add(k, ev.def.immediate[k]!);
      this.crew.adjustMoraleAll(ev.def.moraleHit);
      // مصدومیت — امنیت در برابر نفوذ بیگانه محافظت می‌کند
      const security = this.crew.members.filter((m) => m.task === 'security' && m.status === 'active').length;
      const injChance = ev.type === 'alien_intrusion' ? ev.def.injuryChance / (1 + security * 0.5) : ev.def.injuryChance;
      if (Math.random() < injChance) {
        const pool = this.crew.available();
        if (pool.length) {
          const v = pool[Math.floor(Math.random() * pool.length)];
          const dmg = ev.type === 'alien_intrusion' ? 45 : 30;
          this.crew.injure(v, dmg);
          this.addLog(v.status === 'dead' ? `${v.name} was killed in the ${ev.def.label.toLowerCase()}.` : `${v.name} injured in the ${ev.def.label.toLowerCase()}.`, 'red');
        }
      }
      this.survival = clamp(this.survival - 2);
    }

    // خودکشی
    const hasMedic = this.crew.members.some((m) => m.task === 'medic' && m.status === 'active');
    const s = this.crew.checkSuicide(hasMedic);
    if (s) {
      this.addLog(`${s.name} was found dead in their quarters. The log says only: "I'm sorry."`, 'red');
      this.order = clamp(this.order - 5);
    }

    // شورش
    const avg = this.crew.averageMorale();
    if (this.order < 35 && avg < 35 && !this.mutinyWarned) {
      this.mutinyWarned = true;
      this.addLog('Security reports closed-door meetings. Whispers of mutiny.', 'yellow');
    }
    if (this.order < 25 && avg < 30) {
      const security = this.crew.members.filter((m) => m.task === 'security' && m.status === 'active').length;
      if (Math.random() < 0.08 / (1 + security * 0.4)) {
        this.mutiny = true;
        this.addLog('MUTINY. Armed crew have seized the command module.', 'red');
        this.finish();
      }
    }
  }

  /** آغاز روز جدید */
  private newDay() {
    const rep = this.crew.dailyNeeds(this.resources.values, this.rations);
    this.addLog(`── Day ${this.day} begins. Crew alive: ${this.crew.aliveCount()}/12 ──`, 'cyan');
    if (rep.starving.length) this.addLog(`Hungry: ${rep.starving.join(', ')}`, 'yellow');
    if (rep.thirsty.length) this.addLog(`Dehydrated: ${rep.thirsty.join(', ')}`, 'yellow');
    if (rep.suffocating.length) this.addLog(`Hypoxic: ${rep.suffocating.join(', ')}`, 'red');
    for (const d of rep.deaths) this.addLog(`${d.name} died of ${d.cause}.`, 'red');

    // شاخص بقا: منابع سالم +، بحران‌ها −
    const crit = this.resources.critical().length;
    const brokenN = this.failures.broken().length;
    const healthy = RESOURCE_KEYS.every((k) => this.resources.get(k) > 40);
    this.survival = clamp(this.survival + (healthy ? 3 : 0) - crit * 3 - brokenN * 2 + (this.crew.averageMorale() > 60 ? 1 : 0));
    if (this.crew.averageMorale() < 30) this.order = clamp(this.order - 4);

    // سناریوی اخلاقی
    if (EthicsSystem.isScenarioDay(this.day)) {
      const sc = this.ethics.trigger();
      if (sc) this.presentScenario(sc);
    }
  }

  // ============================================================
  //  Ethics / اخلاق
  // ============================================================
  private presentScenario(sc: EthicsScenario) {
    this.print('');
    this.print(`┌─ DECISION REQUIRED ─ ${sc.title} ─`, 'yellow');
    this.print(`│ ${sc.description}`, 'white');
    sc.options.forEach((o, i) => this.print(`│  [${i + 1}] ${o.text}`, 'cyan'));
    this.print('└─ Type 1, 2 or 3. Time is frozen until you decide.', 'yellow');
    this.addLog(`Decision pending: ${sc.title}`, 'yellow');
  }

  private ethicsContext(): EthicsContext {
    return {
      addResource: (k, a) => this.resources.add(k, a),
      killRandomCrew: (cause) => this.crew.killRandom(cause)?.name ?? null,
      healAll: (a) => this.crew.healAll(a),
      addKey: (n) => this.messages.addKeys(n),
      addFragment: () => this.gainFragment(),
      log: (t, c) => this.addLog(t, c),
      setFlag: (f) => {
        this.ethics.flags.add(f);
      },
    };
  }

  /** دریافت یک قطعه؛ با رسیدن به حد نصاب، سناریوی نهایی «قطعات» فعال می‌شود */
  private gainFragment() {
    this.fragments++;
    this.addLog(`Fragment ${this.fragments}/${CONFIG.MYSTERY_FRAGMENTS_NEEDED} secured.`, 'magenta');
    if (this.fragments === CONFIG.MYSTERY_FRAGMENTS_NEEDED) {
      this.ethics.triggerCustom(this.fragmentsScenario());
      if (this.ethics.pending?.id === 99) this.presentScenario(this.ethics.pending);
    }
  }

  private choose(idx: number) {
    const sc = this.ethics.pending;
    if (!sc) {
      this.print('No decision is pending.', 'gray');
      return;
    }
    const opt = this.ethics.choose(idx, this.ethicsContext());
    if (!opt) return;
    this.crew.adjustMoraleAll(opt.effects.morale);
    this.order = clamp(this.order + opt.effects.order);
    this.survival = clamp(this.survival + opt.effects.survival);
    const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
    this.print(`> ${opt.text}`, 'cyan');
    this.print(opt.outcome, 'white');
    this.print(`  morale ${fmt(opt.effects.morale)}  order ${fmt(opt.effects.order)}  survival ${fmt(opt.effects.survival)}`, 'gray');
    this.addLog(`${sc.title}: decided. (M${fmt(opt.effects.morale)} O${fmt(opt.effects.order)} S${fmt(opt.effects.survival)})`, 'yellow');
  }

  /** سناریوی ویژه وقتی ۳ قطعه جمع شد */
  private fragmentsScenario(): EthicsScenario {
    return {
      id: 99,
      title: 'THE FRAGMENTS',
      description:
        'Three fragments assembled. Farahani reads the pattern: coordinates, a time, and a single word that translates, roughly, to COME. It is not from Earth. Earth has ordered you not to respond.',
      options: [
        {
          text: 'Set course for the coordinates. We were never going to be rescued anyway.',
          effects: { morale: 5, order: -5, survival: 0 },
          outcome: 'The crew are silent. Then Chen starts the engine.',
          extra: (c) => c.setFlag('follow_signal'),
        },
        {
          text: 'Seal the fragments away. We wait for ARTEMIS as ordered.',
          effects: { morale: -3, order: 6, survival: 2 },
          outcome: 'The humming stops. Or you stop hearing it.',
        },
        {
          text: 'Jettison the fragments into the atmosphere.',
          effects: { morale: -6, order: 4, survival: 0 },
          outcome: 'They burn up over the Indian Ocean. The pattern in the comms array does not.',
        },
      ],
    };
  }

  // ============================================================
  //  Messages / پیام‌ها
  // ============================================================
  private receiveMessage() {
    const commsBroken = this.failures.get('comms').broken;
    const msg = this.messages.receive(this.day, commsBroken);
    if (!msg) return;
    this.addLog(`Incoming transmission #${msg.id}${commsBroken ? ' (degraded)' : ''}. Type: message`, 'blue');
  }

  // ============================================================
  //  Exploration / اکتشاف
  // ============================================================
  private resolveExpedition() {
    const exp = this.exploration.active!;
    const team = exp.crewIds.map((id) => this.crew.byId(id));
    const quality = team.reduce((s, m) => s + CrewSystem.efficiency(m, 'explorer'), 0) / team.length;
    const r = this.exploration.resolve(quality, this.ethics.flags.has('answered_signal'), this.fragments);

    const color: LogColor = r.outcome === 'success' ? 'green' : r.outcome === 'mystery' ? 'magenta' : r.outcome === 'danger' ? 'yellow' : 'red';
    this.addLog(`Shuttle returns — ${r.outcome.toUpperCase()}.`, color);
    this.print('');
    this.print(`┌─ EXPEDITION REPORT: ${r.outcome.toUpperCase()}`, color);
    for (const l of r.lines) this.print(`│ ${l}`, 'white');
    this.print('└─', color);

    for (const k of Object.keys(r.resources) as ResourceKey[]) this.resources.add(k, r.resources[k]!);
    if (r.keys) this.messages.addKeys(r.keys);
    if (r.fragment) this.gainFragment();
    for (const id of r.casualties) this.crew.kill(this.crew.byId(id), 'lost on expedition');
    for (const id of r.injuries) this.crew.injure(this.crew.byId(id), 35);
    // بازگشت بازماندگان
    for (const m of team) if (m.status === 'away') m.status = m.health < 40 ? 'injured' : 'active';

    switch (r.outcome) {
      case 'success':
        this.crew.adjustMoraleAll(5);
        this.survival = clamp(this.survival + 3);
        break;
      case 'danger':
        this.crew.adjustMoraleAll(-3);
        break;
      case 'catastrophe':
        this.crew.adjustMoraleAll(-10);
        this.order = clamp(this.order - 6);
        this.survival = clamp(this.survival - 5);
        break;
      case 'mystery':
        this.crew.adjustMoraleAll(-2);
        break;
    }
  }

  // ============================================================
  //  Ending / پایان
  // ============================================================
  private finish() {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.sleeping = false;
    this.ending = this.endings.decide({
      aliveCrew: this.crew.aliveCount(),
      totalCrew: 12,
      order: this.order,
      survival: this.survival,
      fragments: this.fragments,
      flags: this.ethics.flags,
      cruelty: this.ethics.cruelty,
      mutiny: this.mutiny,
      stationLost: this.stationLost,
      engineOnline: !this.failures.get('engine').broken,
      fuel: this.resources.get('fuel'),
    });
    this.endingText = this.endings.text(this.ending, {
      alive: this.crew.aliveCount(),
      order: this.order,
      survival: this.survival,
      days: this.day,
    });
    this.print('');
    this.printLines(this.endingText, this.ending === 'dark' ? 'red' : this.ending === 'mystery' ? 'magenta' : 'green');
    this.notify();
  }

  // ============================================================
  //  Commands / دستورات
  // ============================================================
  execute(raw: string) {
    const input = raw.trim();
    if (!input) return;
    this.print(`> ${input}`, 'gray');

    if (this.phase === 'intro') {
      this.start();
      if (input.toLowerCase() !== 'start') this.execute(input);
      return;
    }
    if (this.phase === 'ended') {
      if (input.toLowerCase() === 'restart') this.restart();
      else this.print('Mission over. Type  restart  to begin again.', 'gray');
      this.notify();
      return;
    }

    const [cmd, ...args] = input.toLowerCase().split(/\s+/);
    switch (cmd) {
      case '1':
      case '2':
      case '3':
        this.choose(Number(cmd) - 1);
        break;
      case 'choose':
      case 'decide':
        this.choose(Number(args[0]) - 1);
        break;
      case 'help':
        this.cmdHelp();
        break;
      case 'status':
      case 'systems':
        this.cmdStatus();
        break;
      case 'crew':
        this.cmdCrew();
        break;
      case 'assign':
        this.cmdAssign(args[0], args[1]);
        break;
      case 'repair':
        this.cmdRepair(args[0]);
        break;
      case 'explore':
        this.cmdExplore(Number(args[0]));
        break;
      case 'message':
      case 'messages':
        this.cmdMessage(args[0]);
        break;
      case 'rations':
        this.cmdRations(args[0]);
        break;
      case 'sleep':
      case 'wait':
        this.cmdSleep();
        break;
      case 'log':
        this.log.slice(-20).forEach((l) => this.print(`[${l.time}] ${l.text}`, l.color));
        break;
      case 'clear':
        this.console = [];
        break;
      case 'restart':
        this.restart();
        return;
      default:
        this.print(`Unknown command: ${cmd}. Type  help.`, 'red');
    }
    this.notify();
  }

  private cmdHelp() {
    this.printLines(
      [
        '┌─ COMMANDS ───────────────────────────────────────────────────',
        '│ status                 full station report (systems, stats, shuttle)',
        '│ crew                   detailed crew roster',
        '│ assign <name> <task>   tasks: engineer medic security scientist cook explorer idle',
        '│ repair <system>        systems: oxygen electrical comms heating engine',
        '│ explore <2-4>          send a shuttle team to the detected object',
        '│ message [list]         decrypt latest transmission (costs 1 key) / list inbox',
        '│ rations <low|normal|high>   set food rations',
        '│ sleep                  advance 10 minutes (interrupted by decisions)',
        '│ 1 / 2 / 3              answer a pending decision',
        '│ log  clear  restart    recent events / clear console / new game',
        '└──────────────────────────────────────────────────────────────',
        'Tips: scientists make O2, engineers make energy, cooks make food,',
        '      medics heal, security keeps order. Specialists work 1.5x faster.',
      ],
      'cyan',
    );
  }

  private cmdStatus() {
    const r = this.resources.values;
    this.print(`┌─ STATION STATUS ─ Day ${this.day}/${CONFIG.TOTAL_DAYS} ${this.clock()} ─ Crew ${this.crew.aliveCount()}/12`, 'cyan');
    for (const k of RESOURCE_KEYS) {
      this.print(`│ ${k.toUpperCase().padEnd(7)} ${ResourceSystem.bar(r[k], 30)} ${String(Math.round(r[k])).padStart(3)}%`, ResourceSystem.color(r[k]));
    }
    this.print(`│ Order ${Math.round(this.order)}  Survival ${Math.round(this.survival)}  Avg morale ${Math.round(this.crew.averageMorale())}  Rations ${this.rations}`, 'white');
    this.print(`│ Keys ${this.messages.keys}  Fragments ${this.fragments}/${CONFIG.MYSTERY_FRAGMENTS_NEEDED}  Shuttle ${Math.round(this.exploration.shuttleIntegrity)}%`, 'white');
    this.print('│ SYSTEMS:', 'white');
    for (const s of this.failures.systems) {
      const st = s.broken
        ? `BROKEN (${FAILURE_DEFS[s.failure!].label})${s.repairCrew.length ? ` repairing ${Math.round((s.repairProgress / CONFIG.REPAIR_WORK_UNITS) * 100)}%` : ' — needs repair'}`
        : `online  integrity ${Math.round(s.integrity)}%`;
      this.print(`│  ${s.key.padEnd(11)} ${st}`, s.broken ? 'red' : 'green');
    }
    if (this.exploration.currentObject) this.print(`│ Object in range: ${this.exploration.currentObject}`, 'magenta');
    if (this.exploration.active) this.print(`│ Shuttle away — returns in ${this.exploration.active.endsAt - this.time}s`, 'magenta');
    this.print('└─', 'cyan');
  }

  private cmdCrew() {
    this.print('┌─ CREW ROSTER ─────────────────────────────────────────────', 'cyan');
    for (const m of this.crew.members) {
      const mood = CrewSystem.mood(m);
      const line = `│ ${m.name.padEnd(10)} ${m.role.padEnd(9)} task:${m.task.padEnd(9)} morale:${String(Math.round(m.morale)).padStart(3)} (${mood.padEnd(10)}) hp:${String(Math.round(m.health)).padStart(3)} eff:${CrewSystem.efficiency(m, m.task)} ${m.status}${m.deathCause ? ` — ${m.deathCause}` : ''}`;
      this.print(line, m.status === 'dead' ? 'gray' : mood === 'depressed' ? 'red' : mood === 'nervous' ? 'yellow' : 'white');
    }
    this.print(`│ needs/day (avg): food ${(this.crew.alive().reduce((s, m) => s + m.needs.food, 0) / Math.max(1, this.crew.aliveCount())).toFixed(1)}  water ${(this.crew.alive().reduce((s, m) => s + m.needs.water, 0) / Math.max(1, this.crew.aliveCount())).toFixed(1)}  O2 ${(this.crew.alive().reduce((s, m) => s + m.needs.oxygen, 0) / Math.max(1, this.crew.aliveCount())).toFixed(1)}`, 'gray');
    this.print('└─', 'cyan');
  }

  private cmdAssign(name?: string, task?: string) {
    if (!name || !task) return this.print('Usage: assign <name> <task>', 'yellow');
    const m = this.crew.find(name);
    if (!m) return this.print(`No crew member named "${name}".`, 'red');
    if (m.status === 'dead') return this.print(`${m.name} is dead.`, 'red');
    if (m.status === 'away') return this.print(`${m.name} is away on the shuttle.`, 'yellow');
    if (m.status === 'repairing') return this.print(`${m.name} is busy repairing. Wait for completion.`, 'yellow');
    if (!(CREW_TASKS as string[]).includes(task)) return this.print(`Unknown task. Use: ${CREW_TASKS.join(' ')}`, 'red');
    this.crew.assign(m, task as CrewTask);
    const spec = task === m.role ? ' (specialist bonus)' : '';
    this.print(`${m.name} assigned to ${task}${spec}. Efficiency ${CrewSystem.efficiency(m, task as CrewTask)}.`, 'green');
    this.addLog(`${m.name} → ${task}`, 'gray');
  }

  private cmdRepair(sys?: string) {
    const key = sys ? FailureSystem.parseSystem(sys) : null;
    if (!key) return this.print('Usage: repair <oxygen|electrical|comms|heating|engine>', 'yellow');
    const team = this.crew.pickRepairers(CONFIG.REPAIR_CREW_REQUIRED);
    const err = this.failures.startRepair(key, team);
    if (err) return this.print(err, 'red');
    const eff = team.reduce((s, m) => s + CrewSystem.efficiency(m, 'engineer'), 0);
    const eta = Math.ceil(CONFIG.REPAIR_WORK_UNITS / Math.max(0.1, eff)) * CONFIG.DRAIN_INTERVAL;
    this.print(`Repair team ${team.map((m) => m.name).join(' & ')} dispatched to ${this.failures.get(key).label}. ETA ~${eta}s.`, 'green');
    this.addLog(`Repair started: ${key} (${team.map((m) => m.name).join(', ')})`, 'green');
  }

  private cmdExplore(n: number) {
    if (!n || Number.isNaN(n)) return this.print('Usage: explore <2-4>', 'yellow');
    const team = this.crew.pickExplorers(n);
    const err = this.exploration.launch(team, n, this.time, this.resources.get('fuel'), this.failures.get('engine').broken);
    if (err) return this.print(err, 'red');
    this.resources.add('fuel', -CONFIG.EXPLORE_FUEL_COST);
    this.print(`Shuttle launched with ${team.map((m) => m.name).join(', ')}. Returns in ${CONFIG.EXPLORE_DURATION}s.`, 'magenta');
    this.addLog(`Shuttle launched (${n} crew) toward ${this.exploration.active!.objectName}.`, 'magenta');
  }

  private cmdMessage(arg?: string) {
    const inbox = this.messages.inbox;
    if (!inbox.length) return this.print('No transmissions received yet.', 'gray');
    if (arg === 'list') {
      this.print('┌─ INBOX', 'blue');
      for (const m of inbox) this.print(`│ #${m.id} D${m.day} [${m.kind}] ${m.decrypted ? m.plain : m.cipher}`, m.decrypted ? 'white' : 'gray');
      this.print(`└─ keys available: ${this.messages.keys}`, 'blue');
      return;
    }
    const target = this.messages.latestUndecrypted() ?? this.messages.latest()!;
    this.print(`┌─ TRANSMISSION #${target.id} (Day ${target.day}) — CAESAR-${CONFIG.CAESAR_SHIFT} ENCRYPTED`, 'blue');
    this.print(`│ ${target.cipher}`, 'gray');
    if (target.decrypted) {
      this.print(`│ DECRYPTED: ${target.plain}`, 'white');
    } else {
      const err = this.messages.decrypt(target);
      if (err) this.print(`│ ${err}`, 'yellow');
      else {
        this.print(`│ DECRYPTED: ${target.plain}`, 'white');
        this.addLog(`Transmission #${target.id} decrypted.`, 'blue');
        if (target.kind === 'rescue') this.crew.adjustMoraleAll(3); // خبر نجات روحیه می‌دهد
      }
    }
    this.print(`└─ keys remaining: ${this.messages.keys}`, 'blue');
  }

  private cmdRations(level?: string) {
    const map: Record<string, RationLevel> = { low: 'low', normal: 'normal', medium: 'normal', high: 'high', 'کم': 'low', 'متوسط': 'normal', 'زیاد': 'high' };
    const r = level ? map[level] : undefined;
    if (!r) return this.print('Usage: rations <low|normal|high>', 'yellow');
    this.rations = r;
    const note = r === 'low' ? 'Crew grumble. Food lasts longer.' : r === 'high' ? 'Crew eat well. Food burns fast.' : 'Standard rations restored.';
    this.print(`Rations set to ${r}. ${note}`, 'green');
    this.addLog(`Rations → ${r}`, 'gray');
    if (r === 'low') this.crew.adjustMoraleAll(-3);
    if (r === 'high') this.crew.adjustMoraleAll(3);
  }

  /** پیشروی سریع ۱۰ دقیقه؛ با دوراهی اخلاقی یا پایان بازی قطع می‌شود */
  private cmdSleep() {
    if (this.ethics.pending) return this.print('A decision is pending. You cannot rest.', 'yellow');
    this.sleeping = true;
    const startDay = this.day;
    let n = 0;
    for (; n < CONFIG.SLEEP_SECONDS; n++) {
      if (this.phase !== 'playing' || this.ethics.pending) break;
      this.tick();
    }
    this.sleeping = false;
    const mins = Math.round(n / 60);
    if (this.phase === 'playing')
      this.print(
        this.ethics.pending ? `You are woken after ${mins} min — a decision is required.` : `You rest for ${mins} minutes. It is now Day ${this.day}${this.day !== startDay ? ' (new day)' : ''}.`,
        'cyan',
      );
  }

  // ============================================================
  //  Snapshot for UI / تصویر لحظه‌ای برای رابط
  // ============================================================
  snapshot(): GameSnapshot {
    return {
      phase: this.phase,
      time: this.time,
      day: this.day,
      resources: { ...this.resources.values },
      crew: this.crew.members.map((m) => ({ ...m })),
      systems: this.failures.systems.map((s) => ({ ...s })),
      log: this.log.slice(-10),
      console: [...this.console],
      order: this.order,
      survival: this.survival,
      rations: this.rations,
      keys: this.messages.keys,
      fragments: this.fragments,
      messages: [...this.messages.inbox],
      pendingScenario: this.ethics.pending,
      expedition: this.exploration.active,
      objectAvailable: this.exploration.currentObject,
      ending: this.ending,
      endingText: this.endingText,
      sleeping: this.sleeping,
    };
  }
}
