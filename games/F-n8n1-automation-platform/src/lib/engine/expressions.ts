// ============================================================================
// Expression Engine – ارزیابی عبارت‌های {{ ... }} داخل پارامترهای نودها
// پشتیبانی از $json, $item, $items, $input, $node["Name"], $vars, $env,
// $now, $today, $execution, $index, $jmespath-like helpers
// ============================================================================

export type Item = { json: Record<string, unknown>; binary?: Record<string, unknown> };

export type ExprContext = {
  item: Item;
  index: number;
  items: Item[];
  nodeOutputs: Record<string, Item[]>; // نام نود → آیتم‌های خروجی
  vars: Record<string, string>;
  executionId?: number;
  workflowId?: number;
  workflowName?: string;
};

const EXPR_RE = /\{\{([\s\S]+?)\}\}/g;

/** آیا مقدار حاوی عبارت است؟ */
export function isExpression(v: unknown): v is string {
  return typeof v === "string" && (v.startsWith("=") || EXPR_RE.test(v));
}

/** ساخت scope برای ارزیابی */
function buildScope(ctx: ExprContext) {
  const nodeProxy = new Proxy(
    {},
    {
      get(_t, name: string) {
        const out = ctx.nodeOutputs[name] ?? [];
        return {
          json: out[0]?.json ?? {},
          all: () => out,
          first: () => out[0],
          last: () => out[out.length - 1],
          item: out[ctx.index] ?? out[0],
        };
      },
    },
  );
  const now = new Date();
  return {
    $json: ctx.item.json,
    $item: ctx.item,
    $index: ctx.index,
    $items: ctx.items,
    $input: {
      all: () => ctx.items,
      first: () => ctx.items[0],
      last: () => ctx.items[ctx.items.length - 1],
      item: ctx.item,
    },
    $node: nodeProxy,
    $vars: ctx.vars,
    $env: {}, // به دلایل امنیتی env در عبارت‌ها در دسترس نیست
    $now: now.toISOString(),
    $nowDate: now,
    $today: now.toISOString().slice(0, 10),
    $timestamp: now.getTime(),
    $execution: { id: ctx.executionId, mode: "manual" },
    $workflow: { id: ctx.workflowId, name: ctx.workflowName },
    $jalali: toJalali,
    $uuid: () => crypto.randomUUID(),
    $random: (n = 1000) => Math.floor(Math.random() * n),
    JSON,
    Math,
    Date,
    String,
    Number,
    Array,
    Object,
    Boolean,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
  };
}

/** ارزیابی یک عبارت JS با scope داده‌شده */
export function evalJs(code: string, ctx: ExprContext): unknown {
  const scope = buildScope(ctx);
  const keys = Object.keys(scope);
  const values = Object.values(scope);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(...keys, `"use strict"; return (${code});`);
  return fn(...values);
}

/** حل مقدار یک رشته که ممکن است حاوی عبارت باشد */
export function resolveString(value: string, ctx: ExprContext): unknown {
  let v = value;
  if (v.startsWith("=")) v = v.slice(1);
  // اگر کل رشته یک عبارت است، مقدار خام برگردان (نه رشته)
  const whole = v.trim().match(/^\{\{([\s\S]+)\}\}$/);
  if (whole && !whole[1].includes("}}")) {
    try {
      return evalJs(whole[1], ctx);
    } catch (e) {
      throw new Error(`Expression error in "${whole[1].trim()}": ${(e as Error).message}`);
    }
  }
  return v.replace(EXPR_RE, (_m, expr) => {
    try {
      const r = evalJs(expr, ctx);
      return typeof r === "object" && r !== null ? JSON.stringify(r) : String(r ?? "");
    } catch (e) {
      throw new Error(`Expression error in "${String(expr).trim()}": ${(e as Error).message}`);
    }
  });
}

/** حل بازگشتی همه پارامترها */
export function resolveParams<T = Record<string, unknown>>(params: unknown, ctx: ExprContext): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return resolveString(v, ctx);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object")
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(params) as T;
}

/** تلاش برای parse کردن JSON؛ اگر نشد مقدار خام برمی‌گردد */
export function parseMaybeJson(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!t) return {};
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.parse(t);
    } catch {
      return v;
    }
  }
  return v;
}

/** تبدیل تاریخ میلادی به شمسی (الگوریتم استاندارد) */
export function toJalali(input?: string | number | Date): string {
  const d = input ? new Date(input) : new Date();
  let gy = d.getFullYear();
  const gm = d.getMonth() + 1;
  const gd = d.getDate();
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 365) days = (days - 1) % 365;
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
}
