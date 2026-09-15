// ==========================================================================
// نودهای هسته: Trigger، منطق شرطی، حلقه، تبدیل داده و کد
// ==========================================================================
import crypto from "crypto";
import zlib from "zlib";
import { exec } from "child_process";
import type { ExecuteContext, FlowItem, NodeDefinition } from "../types";
import { buildScope, resolveExpressionDeep } from "../expression";

function scopeFor(ctx: ExecuteContext, item: FlowItem, index: number, vars: Record<string, string>) {
  return buildScope(item, index, ctx.items, vars);
}

async function withVars(ctx: ExecuteContext) {
  // یک نمای ساده از متغیرها که به‌صورت sync درون scope استفاده می‌شود
  const vars: Record<string, string> = {};
  return vars;
}

export const manualTrigger: NodeDefinition = {
  type: "manualTrigger",
  name: "اجرای دستی (Manual Trigger)",
  group: "trigger",
  category: "Triggers",
  icon: "▶️",
  color: "#64748b",
  description: "شروع دستی Workflow با کلیک روی دکمه‌ی اجرا",
  isTrigger: true,
  properties: [],
  execute: async (ctx) => ctx.items.length ? ctx.items : [{ json: { triggeredAt: new Date().toISOString() } }],
};

export const webhookTrigger: NodeDefinition = {
  type: "webhookTrigger",
  name: "Webhook",
  group: "trigger",
  category: "Triggers",
  icon: "🌐",
  color: "#0ea5e9",
  description: "شروع Workflow با دریافت درخواست HTTP روی مسیر اختصاصی",
  isTrigger: true,
  properties: [
    { name: "path", label: "مسیر (Path)", type: "string", default: "my-webhook", required: true },
    {
      name: "method",
      label: "متد HTTP",
      type: "options",
      default: "POST",
      options: ["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => ({ label: m, value: m })),
    },
    { name: "responseMode", label: "پاسخ", type: "options", default: "lastNode", options: [
      { label: "آخرین نود", value: "lastNode" },
      { label: "دریافت فوری", value: "immediate" },
    ] },
  ],
  execute: async (ctx) => ctx.items,
};

export const scheduleTrigger: NodeDefinition = {
  type: "scheduleTrigger",
  name: "زمان‌بندی (Schedule)",
  group: "trigger",
  category: "Triggers",
  icon: "⏰",
  color: "#f59e0b",
  description: "اجرای دوره‌ای Workflow بر اساس عبارت Cron",
  isTrigger: true,
  properties: [
    { name: "cronExpression", label: "عبارت Cron", type: "string", default: "*/5 * * * *", required: true, description: "مثال: هر ۵ دقیقه = */5 * * * *" },
  ],
  execute: async () => [{ json: { firedAt: new Date().toISOString() } }],
};

export const fileWatcherTrigger: NodeDefinition = {
  type: "fileWatcherTrigger",
  name: "File System Watcher",
  group: "trigger",
  category: "Triggers",
  icon: "📁",
  color: "#f59e0b",
  description: "شروع Workflow با تغییر فایل/پوشه در دیسک محلی (/files)",
  isTrigger: true,
  properties: [
    { name: "directory", label: "پوشه (نسبت به /files)", type: "string", default: "." },
    { name: "events", label: "رویدادها", type: "options", default: "all", options: [
      { label: "همه", value: "all" },
      { label: "فقط تغییر (change)", value: "change" },
      { label: "فقط تغییر نام/ایجاد (rename)", value: "rename" },
    ] },
  ],
  execute: async () => [{ json: { event: "manual-test" } }],
};

export const postgresTrigger: NodeDefinition = {
  type: "postgresTrigger",
  name: "Database Trigger (CDC)",
  group: "trigger",
  category: "Triggers",
  icon: "🗄️",
  color: "#f59e0b",
  description: "شروع Workflow با تغییر ردیف‌ها در جدول PostgreSQL (LISTEN/NOTIFY)",
  isTrigger: true,
  credentialType: "postgres",
  properties: [
    { name: "table", label: "نام جدول", type: "string", required: true },
    { name: "events", label: "رویدادها", type: "options", default: "INSERT,UPDATE,DELETE", options: [
      { label: "INSERT", value: "INSERT" },
      { label: "UPDATE", value: "UPDATE" },
      { label: "DELETE", value: "DELETE" },
      { label: "همه", value: "INSERT,UPDATE,DELETE" },
    ] },
  ],
  execute: async () => [],
};

export const noOp: NodeDefinition = {
  type: "noOp",
  name: "بدون عملیات (No Op)",
  group: "logic",
  category: "Logic",
  icon: "⚪",
  color: "#94a3b8",
  description: "گره‌ای خنثی برای سازمان‌دهی بصری Workflow",
  properties: [],
  execute: async (ctx) => ctx.items,
};

export const setNode: NodeDefinition = {
  type: "set",
  name: "تنظیم فیلدها (Edit Fields / Set)",
  group: "data",
  category: "Data Transformation",
  icon: "✏️",
  color: "#22c55e",
  description: "افزودن/ویرایش فیلدهای JSON با عبارات {{ }}",
  properties: [
    { name: "fieldsJson", label: "فیلدها (JSON)", type: "json", default: '{\n  "newField": "{{$json.someField}}"\n}', rows: 8 },
    { name: "keepOnlySet", label: "فقط فیلدهای تعیین‌شده نگه‌داشته شود", type: "boolean", default: false },
  ],
  execute: async (ctx) => {
    const vars = await withVars(ctx);
    const template = JSON.parse((ctx.parameters.fieldsJson as string) || "{}");
    const keepOnly = Boolean(ctx.parameters.keepOnlySet);
    return ctx.items.map((item, i) => {
      const scope = scopeFor(ctx, item, i, vars);
      const resolved = resolveExpressionDeep(template, scope) as Record<string, unknown>;
      return { json: keepOnly ? resolved : { ...item.json, ...resolved }, binary: item.binary };
    });
  },
};

function compareValues(a: unknown, op: string, b: unknown): boolean {
  switch (op) {
    case "equals": return String(a) === String(b);
    case "notEquals": return String(a) !== String(b);
    case "contains": return String(a).includes(String(b));
    case "notContains": return !String(a).includes(String(b));
    case "gt": return Number(a) > Number(b);
    case "gte": return Number(a) >= Number(b);
    case "lt": return Number(a) < Number(b);
    case "lte": return Number(a) <= Number(b);
    case "isEmpty": return a === undefined || a === null || a === "";
    case "isNotEmpty": return !(a === undefined || a === null || a === "");
    default: return false;
  }
}

export const ifNode: NodeDefinition = {
  type: "if",
  name: "شرط (If)",
  group: "logic",
  category: "Logic",
  icon: "🔀",
  color: "#a855f7",
  description: "مسیردهی داده بر اساس یک شرط (خروجی true/false)",
  outputs: ["true", "false"],
  properties: [
    { name: "left", label: "مقدار چپ", type: "string", default: "{{$json.value}}" },
    { name: "operator", label: "عملگر", type: "options", default: "equals", options: [
      { label: "برابر", value: "equals" },
      { label: "نابرابر", value: "notEquals" },
      { label: "شامل", value: "contains" },
      { label: "شامل نیست", value: "notContains" },
      { label: "بزرگتر", value: "gt" },
      { label: "بزرگتر مساوی", value: "gte" },
      { label: "کوچکتر", value: "lt" },
      { label: "کوچکتر مساوی", value: "lte" },
      { label: "خالی است", value: "isEmpty" },
      { label: "خالی نیست", value: "isNotEmpty" },
    ] },
    { name: "right", label: "مقدار راست", type: "string", default: "" },
  ],
  execute: async (ctx) => {
    const vars = await withVars(ctx);
    const trueItems: FlowItem[] = [];
    const falseItems: FlowItem[] = [];
    ctx.items.forEach((item, i) => {
      const scope = scopeFor(ctx, item, i, vars);
      const left = resolveExpressionDeep(ctx.parameters.left, scope);
      const right = resolveExpressionDeep(ctx.parameters.right, scope);
      const result = compareValues(left, String(ctx.parameters.operator || "equals"), right);
      (result ? trueItems : falseItems).push(item);
    });
    return { true: trueItems, false: falseItems };
  },
};

export const switchNode: NodeDefinition = {
  type: "switch",
  name: "سوییچ (Switch)",
  group: "logic",
  category: "Logic",
  icon: "🔀",
  color: "#a855f7",
  description: "مسیردهی داده به یکی از چند خروجی بر اساس مقدار یک فیلد",
  outputs: ["0", "1", "2", "3", "default"],
  properties: [
    { name: "field", label: "فیلد ({{$json.field}})", type: "string", default: "{{$json.type}}" },
    { name: "case0", label: "مقدار خروجی ۰", type: "string", default: "" },
    { name: "case1", label: "مقدار خروجی ۱", type: "string", default: "" },
    { name: "case2", label: "مقدار خروجی ۲", type: "string", default: "" },
    { name: "case3", label: "مقدار خروجی ۳", type: "string", default: "" },
  ],
  execute: async (ctx) => {
    const vars = await withVars(ctx);
    const out: Record<string, FlowItem[]> = { "0": [], "1": [], "2": [], "3": [], default: [] };
    ctx.items.forEach((item, i) => {
      const scope = scopeFor(ctx, item, i, vars);
      const value = String(resolveExpressionDeep(ctx.parameters.field, scope) ?? "");
      let matched = false;
      for (const idx of ["0", "1", "2", "3"]) {
        const caseVal = ctx.parameters[`case${idx}`];
        if (caseVal !== undefined && caseVal !== "" && String(caseVal) === value) {
          out[idx].push(item);
          matched = true;
          break;
        }
      }
      if (!matched) out.default.push(item);
    });
    return out;
  },
};

export const filterNode: NodeDefinition = {
  type: "filter",
  name: "فیلتر (Filter)",
  group: "logic",
  category: "Logic",
  icon: "🧹",
  color: "#a855f7",
  description: "نگه‌داشتن فقط آیتم‌هایی که در شرط صدق می‌کنند",
  properties: [
    { name: "left", label: "مقدار چپ", type: "string", default: "{{$json.value}}" },
    { name: "operator", label: "عملگر", type: "options", default: "equals", options: [
      { label: "برابر", value: "equals" },
      { label: "نابرابر", value: "notEquals" },
      { label: "شامل", value: "contains" },
      { label: "بزرگتر", value: "gt" },
      { label: "کوچکتر", value: "lt" },
      { label: "خالی نیست", value: "isNotEmpty" },
    ] },
    { name: "right", label: "مقدار راست", type: "string", default: "" },
  ],
  execute: async (ctx) => {
    const vars = await withVars(ctx);
    return ctx.items.filter((item, i) => {
      const scope = scopeFor(ctx, item, i, vars);
      const left = resolveExpressionDeep(ctx.parameters.left, scope);
      const right = resolveExpressionDeep(ctx.parameters.right, scope);
      return compareValues(left, String(ctx.parameters.operator || "equals"), right);
    });
  },
};

export const mergeNode: NodeDefinition = {
  type: "merge",
  name: "ادغام (Merge)",
  group: "logic",
  category: "Logic",
  icon: "🔗",
  color: "#a855f7",
  description: "ادغام چند جریان داده ورودی به یک خروجی",
  properties: [
    { name: "mode", label: "حالت", type: "options", default: "append", options: [
      { label: "پیوست (Append)", value: "append" },
      { label: "ترکیب بر اساس ایندکس", value: "combine" },
    ] },
  ],
  execute: async (ctx) => ctx.items,
};

export const splitInBatches: NodeDefinition = {
  type: "splitInBatches",
  name: "تقسیم به دسته (Split In Batches)",
  group: "logic",
  category: "Logic",
  icon: "📦",
  color: "#a855f7",
  description: "تقسیم آیتم‌های ورودی به دسته‌های کوچکتر برای پردازش حجیم",
  properties: [
    { name: "batchSize", label: "اندازه‌ی دسته", type: "number", default: 10 },
  ],
  execute: async (ctx) => {
    const size = Math.max(1, Number(ctx.parameters.batchSize) || 10);
    const batches: FlowItem[] = [];
    for (let i = 0; i < ctx.items.length; i += size) {
      batches.push({ json: { batchIndex: batches.length, items: ctx.items.slice(i, i + size).map((it) => it.json) } });
    }
    return batches;
  },
};

export const waitNode: NodeDefinition = {
  type: "wait",
  name: "توقف (Wait)",
  group: "logic",
  category: "Logic",
  icon: "⏳",
  color: "#94a3b8",
  description: "توقف اجرا به مدت مشخص (میلی‌ثانیه)",
  properties: [{ name: "ms", label: "مدت (ms)", type: "number", default: 1000 }],
  execute: async (ctx) => {
    const ms = Math.min(30000, Math.max(0, Number(ctx.parameters.ms) || 0));
    await new Promise((r) => setTimeout(r, ms));
    return ctx.items;
  },
};

export const stopAndError: NodeDefinition = {
  type: "stopAndError",
  name: "توقف با خطا (Stop and Error)",
  group: "logic",
  category: "Logic",
  icon: "🛑",
  color: "#ef4444",
  description: "متوقف کردن Workflow و پرتاب یک خطای سفارشی",
  properties: [{ name: "message", label: "پیام خطا", type: "string", default: "خطای دستی" }],
  execute: async (ctx) => {
    throw new Error(String(ctx.parameters.message || "Stop and Error"));
  },
};

export const dateTimeNode: NodeDefinition = {
  type: "dateTime",
  name: "تاریخ و زمان (Date & Time)",
  group: "data",
  category: "Data Transformation",
  icon: "📅",
  color: "#22c55e",
  description: "فرمت‌دهی یا محاسبه‌ی تاریخ/زمان",
  properties: [
    { name: "outputField", label: "نام فیلد خروجی", type: "string", default: "formattedDate" },
    { name: "addDays", label: "افزودن روز (اختیاری)", type: "number", default: 0 },
  ],
  execute: async (ctx) => {
    const addDays = Number(ctx.parameters.addDays) || 0;
    const field = String(ctx.parameters.outputField || "formattedDate");
    return ctx.items.map((item) => {
      const d = new Date();
      d.setDate(d.getDate() + addDays);
      return { json: { ...item.json, [field]: d.toISOString() }, binary: item.binary };
    });
  },
};

export const cryptoNode: NodeDefinition = {
  type: "cryptoHash",
  name: "رمزنگاری/هش (Crypto)",
  group: "data",
  category: "Data Transformation",
  icon: "🔐",
  color: "#22c55e",
  description: "محاسبه‌ی هش (md5/sha1/sha256) یا HMAC روی یک فیلد",
  properties: [
    { name: "field", label: "فیلد ورودی", type: "string", default: "{{$json.text}}" },
    { name: "algorithm", label: "الگوریتم", type: "options", default: "sha256", options: [
      { label: "MD5", value: "md5" },
      { label: "SHA1", value: "sha1" },
      { label: "SHA256", value: "sha256" },
    ] },
    { name: "outputField", label: "فیلد خروجی", type: "string", default: "hash" },
  ],
  execute: async (ctx) => {
    const vars = await withVars(ctx);
    return ctx.items.map((item, i) => {
      const scope = scopeFor(ctx, item, i, vars);
      const value = String(resolveExpressionDeep(ctx.parameters.field, scope) ?? "");
      const hash = crypto.createHash(String(ctx.parameters.algorithm || "sha256")).update(value).digest("hex");
      return { json: { ...item.json, [String(ctx.parameters.outputField || "hash")]: hash }, binary: item.binary };
    });
  },
};

export const convertToFileNode: NodeDefinition = {
  type: "convertToFile",
  name: "تبدیل به فایل (Convert To File)",
  group: "data",
  category: "Data Transformation",
  icon: "🗃️",
  color: "#22c55e",
  description: "تبدیل داده‌ی JSON به فایل باینری (Base64)",
  properties: [
    { name: "fileName", label: "نام فایل", type: "string", default: "data.json" },
    { name: "mimeType", label: "نوع فایل", type: "string", default: "application/json" },
  ],
  execute: async (ctx) => ctx.items.map((item) => ({
    json: item.json,
    binary: {
      data: {
        fileName: String(ctx.parameters.fileName || "data.json"),
        mimeType: String(ctx.parameters.mimeType || "application/json"),
        data: Buffer.from(JSON.stringify(item.json)).toString("base64"),
      },
    },
  })),
};

export const compressionNode: NodeDefinition = {
  type: "compression",
  name: "فشرده‌سازی (Compression)",
  group: "data",
  category: "Data Transformation",
  icon: "🗜️",
  color: "#22c55e",
  description: "فشرده‌سازی/باز کردن فشرده‌سازی متن با Gzip",
  properties: [
    { name: "mode", label: "حالت", type: "options", default: "compress", options: [
      { label: "فشرده‌سازی", value: "compress" },
      { label: "باز کردن فشرده‌سازی", value: "decompress" },
    ] },
    { name: "field", label: "فیلد ورودی", type: "string", default: "{{$json.text}}" },
    { name: "outputField", label: "فیلد خروجی", type: "string", default: "compressed" },
  ],
  execute: async (ctx) => {
    const vars = await withVars(ctx);
    return ctx.items.map((item, i) => {
      const scope = scopeFor(ctx, item, i, vars);
      const value = String(resolveExpressionDeep(ctx.parameters.field, scope) ?? "");
      const outputField = String(ctx.parameters.outputField || "compressed");
      let result: string;
      if (ctx.parameters.mode === "decompress") {
        result = zlib.gunzipSync(Buffer.from(value, "base64")).toString("utf8");
      } else {
        result = zlib.gzipSync(Buffer.from(value, "utf8")).toString("base64");
      }
      return { json: { ...item.json, [outputField]: result }, binary: item.binary };
    });
  },
};

export const itemListsNode: NodeDefinition = {
  type: "itemLists",
  name: "لیست آیتم‌ها (Aggregate/Split)",
  group: "data",
  category: "Data Transformation",
  icon: "📋",
  color: "#22c55e",
  description: "تجمیع همه‌ی آیتم‌ها در یک آیتم یا شکستن یک آرایه به چند آیتم",
  properties: [
    { name: "mode", label: "حالت", type: "options", default: "aggregate", options: [
      { label: "تجمیع (Aggregate)", value: "aggregate" },
      { label: "شکستن آرایه (Split)", value: "split" },
    ] },
    { name: "field", label: "نام فیلد آرایه (برای Split)", type: "string", default: "items" },
  ],
  execute: async (ctx) => {
    if (ctx.parameters.mode === "split") {
      const field = String(ctx.parameters.field || "items");
      const out: FlowItem[] = [];
      for (const item of ctx.items) {
        const arr = item.json[field];
        if (Array.isArray(arr)) {
          for (const el of arr) out.push({ json: typeof el === "object" && el !== null ? (el as Record<string, unknown>) : { value: el } });
        }
      }
      return out;
    }
    return [{ json: { items: ctx.items.map((i) => i.json), count: ctx.items.length } }];
  },
};

export const codeNode: NodeDefinition = {
  type: "code",
  name: "کد (Code - JavaScript)",
  group: "data",
  category: "Code",
  icon: "🧑‍💻",
  color: "#0f172a",
  description: "نوشتن جاوااسکریپت دلخواه برای پردازش آیتم‌ها ($items, $json)",
  properties: [
    {
      name: "code",
      label: "کد جاوااسکریپت",
      type: "code",
      rows: 12,
      default: "// items: آرایه‌ای از { json } \n// باید یک آرایه از { json } برگردانید\nreturn items.map(item => ({ json: { ...item.json, processed: true } }));",
    },
  ],
  execute: async (ctx) => {
    const vars = await withVars(ctx);
    const code = String(ctx.parameters.code || "return items;");
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      "items",
      "$vars",
      "helpers",
      `"use strict"; return (async () => { ${code} })();`,
    );
    const result = await fn(ctx.items, vars, {
      hash: (s: string) => crypto.createHash("sha256").update(s).digest("hex"),
    });
    if (!Array.isArray(result)) {
      throw new Error("کد Code باید آرایه‌ای از { json } برگرداند");
    }
    return result as FlowItem[];
  },
};

export const bashScriptNode: NodeDefinition = {
  type: "bashScript",
  name: "اجرای اسکریپت Bash",
  group: "data",
  category: "Code",
  icon: "💻",
  color: "#0f172a",
  description: "اجرای دستور/اسکریپت Bash روی سرور و بازگرداندن خروجی",
  properties: [
    { name: "script", label: "اسکریپت Bash", type: "code", rows: 8, default: "echo \"hello from bash\"" },
    { name: "timeoutMs", label: "Timeout (ms)", type: "number", default: 10000 },
  ],
  execute: async (ctx) => {
    const script = String(ctx.parameters.script || "");
    const timeout = Number(ctx.parameters.timeoutMs) || 10000;
    return new Promise<FlowItem[]>((resolve) => {
      exec(script, { timeout, shell: "/bin/bash" }, (error, stdout, stderr) => {
        resolve([
          {
            json: {
              exitCode: error ? (error as unknown as { code?: number }).code ?? 1 : 0,
              stdout: stdout?.toString() ?? "",
              stderr: stderr?.toString() ?? "",
              error: error ? error.message : null,
            },
          },
        ]);
      });
    });
  },
};

export const coreNodes: NodeDefinition[] = [
  manualTrigger,
  webhookTrigger,
  scheduleTrigger,
  fileWatcherTrigger,
  postgresTrigger,
  noOp,
  setNode,
  ifNode,
  switchNode,
  filterNode,
  mergeNode,
  splitInBatches,
  waitNode,
  stopAndError,
  dateTimeNode,
  cryptoNode,
  convertToFileNode,
  compressionNode,
  itemListsNode,
  codeNode,
  bashScriptNode,
];
