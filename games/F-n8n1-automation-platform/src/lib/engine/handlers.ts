// ============================================================================
// Node Handlers – پیاده‌سازی اجرایی نودها (سمت سرور)
// هر هندلر ورودی‌ها را می‌گیرد و خروجی را به تفکیک هندل برمی‌گرداند
// ============================================================================
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import net from "net";
import dgram from "dgram";
import zlib from "zlib";
import { exec, spawn } from "child_process";
import { Pool } from "pg";
import type { WorkflowNode } from "@/db/schema";
import type { NodeDef } from "@/lib/nodes/catalog";
import { type Item, type ExprContext, resolveParams, parseMaybeJson, evalJs, toJalali } from "./expressions";
import { chat, embed, memory, vectorStore, resolveApiKey, type ChatMessage } from "./llm";

export type HandlerOutput = Record<string, Item[]>;

export type HandlerCtx = {
  node: WorkflowNode;
  def: NodeDef;
  items: Item[];
  nodeOutputs: Record<string, Item[]>;
  vars: Record<string, string>;
  credential: Record<string, string>;
  executionId?: number;
  workflowId?: number;
  workflowName?: string;
  triggerData?: unknown;
  log: (level: "info" | "warn" | "error" | "debug", message: string) => void;
  runSubWorkflow: (workflowId: number, items: Item[]) => Promise<Item[]>;
  /** پارامترهای حل‌شده برای آیتم i */
  p: (i?: number) => Record<string, unknown>;
};

export type Handler = (ctx: HandlerCtx) => Promise<HandlerOutput>;

const FILES_DIR = process.env.FILES_DIR ?? "/files";
const ALLOW_SHELL = process.env.ALLOW_SHELL_NODES !== "false";

const asItems = (data: unknown): Item[] => {
  if (Array.isArray(data)) return data.map((d) => (d && typeof d === "object" && "json" in (d as object) ? (d as Item) : { json: (typeof d === "object" && d !== null ? d : { value: d }) as Record<string, unknown> }));
  if (data && typeof data === "object") return [{ json: data as Record<string, unknown> }];
  return [{ json: { value: data } }];
};
const str = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const safePath = (p: string) => {
  const resolved = path.resolve(p.startsWith("/") ? p : path.join(FILES_DIR, p));
  return resolved;
};
const run = (cmd: string, opts: { cwd?: string; timeout?: number; input?: string } = {}) =>
  new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    const child = exec(cmd, { cwd: opts.cwd, timeout: opts.timeout ?? 30000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ stdout: String(stdout), stderr: String(stderr), exitCode: err ? ((err as { code?: number }).code ?? 1) : 0 }),
    );
    if (opts.input && child.stdin) {
      child.stdin.write(opts.input);
      child.stdin.end();
    }
  });

/** درخواست HTTP با احراز هویت از credential */
async function doFetch(url: string, init: RequestInit & { timeout?: number }, cred: Record<string, string>) {
  const headers = new Headers(init.headers ?? {});
  if (cred.authType === "basic" && cred.username) headers.set("Authorization", "Basic " + Buffer.from(`${cred.username}:${cred.password ?? ""}`).toString("base64"));
  else if (cred.authType === "header" && cred.token) headers.set(cred.headerName || "X-API-Key", cred.token);
  else if (cred.token || cred.apiKey || cred.accessToken || cred.botToken) headers.set("Authorization", `Bearer ${cred.token ?? cred.apiKey ?? cred.accessToken ?? cred.botToken}`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeout ?? 30000);
  try {
    const started = Date.now();
    const res = await fetch(url, { ...init, headers, signal: ctrl.signal });
    const ct = res.headers.get("content-type") ?? "";
    const text = await res.text();
    let body: unknown = text;
    if (ct.includes("json") || /^[\[{]/.test(text.trim())) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { status: res.status, ok: res.ok, headers: Object.fromEntries(res.headers.entries()), body, durationMs: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

/** تبدیل cURL به پارامترهای درخواست */
export function parseCurl(curl: string) {
  const out: { method: string; url: string; headers: Record<string, string>; body?: string } = { method: "GET", url: "", headers: {} };
  const tokens = curl.replace(/\\\n/g, " ").match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  const unq = (s: string) => s.replace(/^['"]|['"]$/g, "");
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "curl") continue;
    if (t === "-X" || t === "--request") out.method = unq(tokens[++i] ?? "GET").toUpperCase();
    else if (t === "-H" || t === "--header") {
      const [k, ...v] = unq(tokens[++i] ?? "").split(":");
      if (k) out.headers[k.trim()] = v.join(":").trim();
    } else if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "--json") {
      out.body = unq(tokens[++i] ?? "");
      if (out.method === "GET") out.method = "POST";
      if (t === "--json") out.headers["Content-Type"] = "application/json";
    } else if (t === "-u" || t === "--user") out.headers["Authorization"] = "Basic " + Buffer.from(unq(tokens[++i] ?? "")).toString("base64");
    else if (!t.startsWith("-") && !out.url) out.url = unq(t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
export const handlers: Record<string, Handler> = {
  // ------------------------------ Trigger ---------------------------------
  async trigger({ node, triggerData, p }) {
    if (triggerData !== undefined && triggerData !== null) return { main: asItems(triggerData) };
    const params = p(0);
    if (node.type === "manualTrigger") return { main: asItems(parseMaybeJson(params.payload) ?? {}) };
    if (node.type === "chatTrigger") return { main: [{ json: { message: params.message ?? "سلام", sessionId: "manual" } }] };
    if (node.type === "scheduleTrigger") return { main: [{ json: { timestamp: new Date().toISOString(), cron: params.cron } }] };
    return { main: [{ json: { trigger: node.type, sample: true, timestamp: new Date().toISOString(), ...params } }] };
  },

  async noop({ items }) {
    return { main: items };
  },

  // ---------------------------------- HTTP --------------------------------
  async httpRequest({ items, p, credential, log }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const params = p(i);
      let method = str(params.method || "GET");
      let url = str(params.url);
      let headers = (parseMaybeJson(params.headers) ?? {}) as Record<string, string>;
      let bodyRaw: unknown = parseMaybeJson(params.body);
      if (params.curl && str(params.curl).trim()) {
        const c = parseCurl(str(params.curl));
        method = c.method;
        url = c.url || url;
        headers = { ...c.headers, ...headers };
        if (c.body) bodyRaw = parseMaybeJson(c.body);
      }
      if (!url) throw new Error("URL الزامی است");
      const q = (parseMaybeJson(params.query) ?? {}) as Record<string, unknown>;
      const u = new URL(url);
      for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
      const bodyType = str(params.bodyType || "json");
      let body: string | undefined;
      if (!["GET", "HEAD"].includes(method) && bodyType !== "none") {
        if (bodyType === "json") {
          headers["Content-Type"] ??= "application/json";
          body = typeof bodyRaw === "string" ? bodyRaw : JSON.stringify(bodyRaw ?? {});
        } else if (bodyType === "form") {
          headers["Content-Type"] ??= "application/x-www-form-urlencoded";
          body = new URLSearchParams(Object.entries((bodyRaw ?? {}) as Record<string, string>).map(([k, v]) => [k, String(v)])).toString();
        } else body = str(bodyRaw);
      }
      log("debug", `${method} ${u.toString()}`);
      const res = await doFetch(u.toString(), { method, headers, body, timeout: num(params.timeout, 30000) }, credential);
      if (!res.ok) log("warn", `HTTP ${res.status} از ${u.hostname}`);
      const rf = str(params.responseFormat || "auto");
      out.push({ json: { statusCode: res.status, headers: res.headers, body: rf === "text" ? str(res.body) : res.body, durationMs: res.durationMs } });
    }
    return { main: out };
  },

  async graphql({ items, p, credential }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const params = p(i);
      const res = await doFetch(
        str(params.endpoint),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...((parseMaybeJson(params.headers) ?? {}) as Record<string, string>) },
          body: JSON.stringify({ query: params.query, variables: parseMaybeJson(params.variables) ?? {} }),
        },
        credential,
      );
      out.push({ json: (res.body as Record<string, unknown>) ?? {} });
    }
    return { main: out };
  },

  /** هندلر عمومی برای 400+ یکپارچه‌سازی – فراخوانی REST با credential */
  async genericApi({ items, p, credential, def, log }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const params = p(i);
      const meta = def.meta ?? {};
      const baseUrl = str(credential.baseUrl || meta.baseUrl || "");
      let endpoint = str(params.endpoint || "");
      if (endpoint && !/^https?:\/\//.test(endpoint)) endpoint = baseUrl.replace(/\/$/, "") + "/" + endpoint.replace(/^\//, "");
      const simulate = params.simulate === true || !endpoint;
      if (simulate) {
        log("info", `${def.name}: حالت شبیه‌سازی (${params.operation})`);
        out.push({
          json: {
            simulated: true,
            integration: meta.integration ?? def.name,
            resource: meta.resource,
            operation: params.operation,
            input: items[i]?.json ?? {},
            result: { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ok: true },
          },
        });
        continue;
      }
      const opMethod: Record<string, string> = { create: "POST", get: "GET", getAll: "GET", update: "PATCH", delete: "DELETE", search: "GET", custom: str(params.method || "GET") };
      const method = params.method && params.operation === "custom" ? str(params.method) : opMethod[str(params.operation)] ?? "GET";
      const u = new URL(endpoint);
      for (const [k, v] of Object.entries((parseMaybeJson(params.query) ?? {}) as Record<string, unknown>)) u.searchParams.set(k, String(v));
      const body = ["GET", "HEAD", "DELETE"].includes(method) ? undefined : JSON.stringify(parseMaybeJson(params.body) ?? {});
      const res = await doFetch(u.toString(), { method, headers: { "Content-Type": "application/json" }, body }, credential);
      out.push({ json: { statusCode: res.status, body: res.body, integration: meta.integration } });
    }
    return { main: out };
  },

  async respond({ items, p }) {
    const params = p(0);
    const body = parseMaybeJson(params.body);
    return { main: [{ json: { __respond: true, statusCode: num(params.statusCode, 200), body: body ?? items.map((i) => i.json) } }] };
  },

  // ---------------------------------- Logic -------------------------------
  async if({ items, p }) {
    const t: Item[] = [],
      f: Item[] = [];
    items.forEach((it, i) => {
      const c = p(i).condition;
      (c === true || c === "true" ? t : f).push(it);
    });
    return { true: t, false: f };
  },

  async switch({ items, p }) {
    const out: HandlerOutput = { "0": [], "1": [], "2": [], "3": [], fallback: [] };
    items.forEach((it, i) => {
      const params = p(i);
      const rules = (parseMaybeJson(params.rules) as unknown[]) ?? [];
      const idx = rules.findIndex((r) => String(r) === String(params.value));
      (idx >= 0 && idx < 4 ? out[String(idx)] : out.fallback).push(it);
    });
    return out;
  },

  async filter({ items, p }) {
    return { main: items.filter((_, i) => p(i).condition === true || p(i).condition === "true") };
  },

  async merge({ items, p, nodeOutputs, node }) {
    const params = p(0);
    const mode = str(params.mode || "append");
    // ورودی‌ها به صورت flat در items هستند (append پیش‌فرض). برای combine از metadata __inputIndex استفاده می‌کنیم
    const strip = (i: Item): Item => ({ json: Object.fromEntries(Object.entries(i.json).filter(([k]) => k !== "__inputIndex")) });
    const a: Item[] = items.filter((i) => (i.json.__inputIndex ?? 0) === 0).map(strip);
    const b: Item[] = items.filter((i) => i.json.__inputIndex === 1).map(strip);
    void nodeOutputs;
    void node;
    if (mode === "combineByPosition") return { main: a.map((x, i) => ({ json: { ...x.json, ...(b[i]?.json ?? {}) } })) };
    if (mode === "combineByKey") {
      const key = str(params.key || "id");
      return { main: a.map((x) => ({ json: { ...x.json, ...(b.find((y) => y.json[key] === x.json[key])?.json ?? {}) } })) };
    }
    return { main: items.map((i) => ({ json: Object.fromEntries(Object.entries(i.json).filter(([k]) => k !== "__inputIndex")) })) };
  },

  async loop({ items, p }) {
    // اجرای واقعی حلقه در executor انجام می‌شود؛ اینجا فقط اندازه دسته را اعلام می‌کنیم
    const size = Math.max(1, num(p(0).batchSize, 1));
    return { loop: items.slice(0, size), done: [] };
  },

  async wait({ items, p }) {
    const s = Math.min(num(p(0).seconds, 1), 300);
    await new Promise((r) => setTimeout(r, s * 1000));
    return { main: items };
  },

  async stopAndError({ p }) {
    throw new Error(str(p(0).message || "Stopped"));
  },

  async executeWorkflow({ items, p, runSubWorkflow, log }) {
    const id = num(p(0).workflowId);
    if (!id) throw new Error("workflowId الزامی است");
    log("info", `اجرای Sub-workflow #${id}`);
    const res = await runSubWorkflow(id, items);
    return { main: res };
  },

  async humanApproval({ items, p, log }) {
    const params = p(0);
    log("warn", `درخواست تأیید انسانی: ${str(params.message)} → ${str(params.autoDecision)}`);
    const approved = str(params.autoDecision || "approved") === "approved";
    const tagged = items.map((i) => ({ json: { ...i.json, approval: { decision: approved ? "approved" : "rejected", message: params.message, at: new Date().toISOString() } } }));
    return approved ? { approved: tagged, rejected: [] } : { approved: [], rejected: tagged };
  },

  async globalVariables({ items, vars }) {
    return { main: (items.length ? items : [{ json: {} }]).map((i) => ({ json: { ...i.json, vars } })) };
  },

  // ---------------------------------- Code --------------------------------
  async codeJs({ items, p, vars, nodeOutputs, log, executionId, workflowId, workflowName }) {
    const params = p(0);
    const code = str(params.code);
    const mode = str(params.mode || "allItems");
    const makeScope = (item: Item, index: number) => {
      const ctx: ExprContext = { item, index, items, nodeOutputs, vars, executionId, workflowId, workflowName };
      return {
        $input: { all: () => items, first: () => items[0], last: () => items[items.length - 1], item },
        $json: item.json,
        $items: items,
        $index: index,
        $vars: vars,
        $node: new Proxy({}, { get: (_t, n: string) => ({ json: nodeOutputs[n]?.[0]?.json ?? {}, all: () => nodeOutputs[n] ?? [] }) }),
        $now: new Date().toISOString(),
        $jalali: toJalali,
        $eval: (expr: string) => evalJs(expr, ctx),
        console: { log: (...a: unknown[]) => log("info", a.map(str).join(" ")), error: (...a: unknown[]) => log("error", a.map(str).join(" ")), warn: (...a: unknown[]) => log("warn", a.map(str).join(" ")) },
        fetch,
        crypto,
        // require محدود به ماژول‌های امن Node
        require: (name: string) => {
          const allowed: Record<string, unknown> = { crypto, path, zlib, url: URL, buffer: Buffer };
          if (name in allowed) return allowed[name];
          // پکیج‌های npm نصب‌شده در کانتینر (NODE_FUNCTION_ALLOW_EXTERNAL)
          const ext = (process.env.NODE_FUNCTION_ALLOW_EXTERNAL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
          if (ext.includes(name) || ext.includes("*")) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            return require(name);
          }
          throw new Error(`ماژول "${name}" مجاز نیست. NODE_FUNCTION_ALLOW_EXTERNAL را تنظیم کنید.`);
        },
      };
    };
    const runCode = async (scope: Record<string, unknown>) => {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...a: string[]) => (...b: unknown[]) => Promise<unknown>;
      const fn = new AsyncFunction(...Object.keys(scope), code);
      return fn(...Object.values(scope));
    };
    if (mode === "eachItem") {
      const out: Item[] = [];
      for (let i = 0; i < items.length; i++) {
        const r = await runCode(makeScope(items[i], i));
        if (r !== undefined) out.push(...asItems(r));
      }
      return { main: out };
    }
    const r = await runCode(makeScope(items[0] ?? { json: {} }, 0));
    return { main: r === undefined ? items : asItems(r) };
  },

  async codePython({ items, p }) {
    if (!ALLOW_SHELL) throw new Error("اجرای Python غیرفعال است (ALLOW_SHELL_NODES=false)");
    const code = str(p(0).code);
    const file = path.join("/tmp", `ff-${crypto.randomUUID()}.py`);
    await fs.writeFile(file, code);
    try {
      const r = await run(`python3 ${file}`, { input: JSON.stringify(items), timeout: 60000 });
      if (r.exitCode !== 0) throw new Error(r.stderr || `python exit ${r.exitCode}`);
      const parsed = parseMaybeJson(r.stdout.trim());
      return { main: typeof parsed === "string" ? [{ json: { stdout: parsed } }] : asItems(parsed) };
    } finally {
      await fs.unlink(file).catch(() => {});
    }
  },

  async bash({ items, p, log }) {
    if (!ALLOW_SHELL) throw new Error("اجرای Bash غیرفعال است (ALLOW_SHELL_NODES=false)");
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const params = p(i);
      const r = await run(str(params.script), { cwd: str(params.cwd || "/tmp"), timeout: num(params.timeout, 30000) });
      if (r.exitCode !== 0) log("warn", `Bash exit code ${r.exitCode}`);
      out.push({ json: { stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode } });
    }
    return { main: out };
  },

  async expression({ items, p }) {
    return { main: items.map((it, i) => ({ json: { ...it.json, [str(p(i).outputField || "result")]: p(i).expression } })) };
  },

  // ---------------------------------- Data --------------------------------
  async set({ items, p }) {
    const src = items.length ? items : [{ json: {} }];
    return {
      main: src.map((it, i) => {
        const params = p(i);
        const fields = (parseMaybeJson(params.fields) ?? {}) as Record<string, unknown>;
        return { json: params.keepOnlySet ? fields : { ...it.json, ...fields } };
      }),
    };
  },
  async sort({ items, p }) {
    const { field, order } = p(0);
    const f = str(field || "id");
    const sorted = [...items].sort((a, b) => ((a.json[f] as number) > (b.json[f] as number) ? 1 : (a.json[f] as number) < (b.json[f] as number) ? -1 : 0));
    return { main: order === "desc" ? sorted.reverse() : sorted };
  },
  async limit({ items, p }) {
    return { main: items.slice(0, num(p(0).max, 10)) };
  },
  async removeDuplicates({ items, p }) {
    const f = str(p(0).field);
    const seen = new Set<string>();
    return { main: items.filter((i) => { const k = f ? str(i.json[f]) : JSON.stringify(i.json); if (seen.has(k)) return false; seen.add(k); return true; }) };
  },
  async splitOut({ items, p }) {
    const out: Item[] = [];
    items.forEach((it, i) => {
      const f = str(p(i).field || "items");
      const arr = it.json[f];
      if (Array.isArray(arr)) arr.forEach((x) => out.push({ json: typeof x === "object" && x ? (x as Record<string, unknown>) : { value: x } }));
      else out.push(it);
    });
    return { main: out };
  },
  async aggregate({ items, p }) {
    return { main: [{ json: { [str(p(0).outputField || "data")]: items.map((i) => i.json), count: items.length } }] };
  },
  async summarize({ items, p }) {
    const { field, groupBy } = p(0);
    const f = str(field || "amount"), g = str(groupBy);
    const groups = new Map<string, number[]>();
    for (const it of items) { const k = g ? str(it.json[g]) : "all"; groups.set(k, [...(groups.get(k) ?? []), num(it.json[f])]); }
    return { main: [...groups.entries()].map(([k, vals]) => ({ json: { ...(g ? { [g]: k } : {}), count: vals.length, sum: vals.reduce((a, b) => a + b, 0), avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, min: Math.min(...vals), max: Math.max(...vals) } })) };
  },
  async renameKeys({ items, p }) {
    const map = (parseMaybeJson(p(0).mapping) ?? {}) as Record<string, string>;
    return { main: items.map((i) => ({ json: Object.fromEntries(Object.entries(i.json).map(([k, v]) => [map[k] ?? k, v])) })) };
  },
  async dateTime({ items, p }) {
    return { main: (items.length ? items : [{ json: {} }]).map((it, i) => {
      const params = p(i); const of = str(params.outputField || "dateTime"); const op = str(params.operation || "now");
      const base = params.value && str(params.value) ? new Date(str(params.value)) : new Date();
      let v: unknown = base.toISOString();
      if (op === "add") v = new Date(base.getTime() + num(params.amount) * 1000).toISOString();
      if (op === "jalali") v = toJalali(base);
      if (op === "format") v = base.toLocaleString("fa-IR");
      return { json: { ...it.json, [of]: v } };
    }) };
  },
  async crypto({ items, p }) {
    return { main: (items.length ? items : [{ json: {} }]).map((it, i) => {
      const params = p(i); const v = str(params.value); const of = str(params.outputField || "hash"); let r: string;
      switch (str(params.action)) {
        case "md5": r = crypto.createHash("md5").update(v).digest("hex"); break;
        case "hmac": r = crypto.createHmac("sha256", str(params.secret)).update(v).digest("hex"); break;
        case "uuid": r = crypto.randomUUID(); break;
        case "base64": r = Buffer.from(v).toString("base64"); break;
        case "base64decode": r = Buffer.from(v, "base64").toString("utf8"); break;
        default: r = crypto.createHash("sha256").update(v).digest("hex");
      }
      return { json: { ...it.json, [of]: r } };
    }) };
  },
  async markdown({ items, p }) {
    const md2html = (s: string) => s
      .replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/\*(.*?)\*/g, "<i>$1</i>").replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>').replace(/^- (.*)$/gm, "<li>$1</li>").replace(/\n{2,}/g, "<br/><br/>");
    return { main: items.map((it, i) => ({ json: { ...it.json, [str(p(i).outputField || "html")]: md2html(str(p(i).value)) } })) };
  },
  async htmlExtract({ items, p }) {
    return { main: items.map((it, i) => { const params = p(i); const re = new RegExp(str(params.regex), "gis"); const m = [...str(params.html).matchAll(re)].map((x) => x[1] ?? x[0]); return { json: { ...it.json, [str(params.outputField || "extracted")]: m.length === 1 ? m[0] : m } }; }) };
  },
  async xml({ items, p }) {
    const toXml = (o: unknown, tag = "root"): string => typeof o === "object" && o ? `<${tag}>${Object.entries(o as Record<string, unknown>).map(([k, v]) => toXml(v, k)).join("")}</${tag}>` : `<${tag}>${str(o)}</${tag}>`;
    const toJson = (x: string): unknown => { const obj: Record<string, unknown> = {}; const re = /<([\w:-]+)[^>]*>([\s\S]*?)<\/\1>/g; let m; let any = false; while ((m = re.exec(x))) { any = true; const inner = toJson(m[2]); if (obj[m[1]] !== undefined) obj[m[1]] = ([] as unknown[]).concat(obj[m[1]] as unknown[], [inner]); else obj[m[1]] = inner; } return any ? obj : x.trim(); };
    return { main: items.map((it, i) => { const params = p(i); return { json: { ...it.json, ...(params.mode === "toXml" ? { xml: toXml(parseMaybeJson(params.value) ?? it.json) } : { data: toJson(str(params.value)) }) } }; }) };
  },
  async compression({ items, p }) {
    return { main: items.map((it, i) => { const params = p(i); const v = str(params.value); return { json: { ...it.json, ...(params.mode === "decompress" ? { decompressed: zlib.gunzipSync(Buffer.from(v, "base64")).toString("utf8") } : { compressed: zlib.gzipSync(Buffer.from(v)).toString("base64"), originalSize: v.length }) } }; }) };
  },
  async convertToFile({ items, p }) {
    const params = p(0); const fmt = str(params.format || "csv");
    const name = str(params.fileName || `export-${Date.now()}.${fmt}`).replace(/[^\w.\-]/g, "_");
    const rows = items.map((i) => i.json);
    let content: string;
    if (fmt === "json") content = JSON.stringify(rows, null, 2);
    else if (fmt === "txt") content = rows.map((r) => JSON.stringify(r)).join("\n");
    else { const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]; content = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${str(r[k]).replace(/"/g, '""')}"`).join(","))].join("\n"); }
    const file = path.join(FILES_DIR, name);
    await fs.mkdir(FILES_DIR, { recursive: true }).catch(() => {});
    await fs.writeFile(file, content).catch(async () => { await fs.mkdir("/tmp/files", { recursive: true }); await fs.writeFile(path.join("/tmp/files", name), content); });
    return { main: [{ json: { fileName: name, path: file, size: content.length, format: fmt, rows: rows.length } }] };
  },
  async readWriteFile({ items, p }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const params = p(i); const fp = safePath(str(params.path)); const op = str(params.operation || "read");
      if (op === "read") out.push({ json: { path: fp, content: await fs.readFile(fp, "utf8") } });
      else if (op === "write") { await fs.mkdir(path.dirname(fp), { recursive: true }); await fs.writeFile(fp, str(params.content)); out.push({ json: { path: fp, written: true } }); }
      else if (op === "list") out.push({ json: { path: fp, files: await fs.readdir(fp) } });
      else if (op === "delete") { await fs.unlink(fp); out.push({ json: { path: fp, deleted: true } }); }
    }
    return { main: out };
  },
  async extractFromFile({ p }) {
    const params = p(0); const content = await fs.readFile(safePath(str(params.path)), "utf8"); const fmt = str(params.format || "csv");
    if (fmt === "json") return { main: asItems(JSON.parse(content)) };
    if (fmt === "txt") return { main: content.split("\n").map((l) => ({ json: { line: l } })) };
    const [h, ...rows] = content.split(/\r?\n/).filter(Boolean); const keys = h.split(",").map((k) => k.replace(/^"|"$/g, ""));
    return { main: rows.map((r) => ({ json: Object.fromEntries(r.split(",").map((v, i) => [keys[i], v.replace(/^"|"$/g, "")])) })) };
  },
  async rss({ p, credential }) {
    const res = await doFetch(str(p(0).url), { method: "GET" }, credential);
    const xml = str(res.body);
    const entries = [...xml.matchAll(/<(item|entry)>([\s\S]*?)<\/\1>/g)].map((m) => { const g = (t: string) => (m[2].match(new RegExp(`<${t}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${t}>`))?.[1] ?? "").trim(); return { json: { title: g("title"), link: g("link") || (m[2].match(/<link[^>]*href="([^"]+)"/)?.[1] ?? ""), pubDate: g("pubDate") || g("updated"), description: g("description") || g("summary") } }; });
    return { main: entries };
  },

  // ---------------------------------- AI ----------------------------------
  async llmChat({ items, p, credential, log }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const params = p(i); const provider = str(params.provider || credential.provider || "openai");
      const msgs: ChatMessage[] = []; if (params.systemPrompt) msgs.push({ role: "system", content: str(params.systemPrompt) }); msgs.push({ role: "user", content: str(params.prompt) });
      const r = await chat({ provider, model: str(params.model), apiKey: resolveApiKey(provider, credential), baseUrl: credential.baseUrl, temperature: num(params.temperature, 0.3), jsonOutput: params.jsonOutput === true }, msgs);
      if (r.simulated) log("warn", "LLM در حالت شبیه‌سازی (API Key تنظیم نشده)");
      out.push({ json: { ...(items[i]?.json ?? {}), output: r.text, parsed: params.jsonOutput ? parseMaybeJson(r.text) : undefined, provider, model: params.model, simulated: r.simulated ?? false } });
    }
    return { main: out };
  },

  /** AI Agent با حلقه ReAct ساده: ابزارها http / js / subworkflow / agent */
  async aiAgent({ items, p, credential, log, runSubWorkflow }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const params = p(i); const provider = str(params.provider || credential.provider || "openai");
      const tools = ((parseMaybeJson(params.tools) as { name: string; description: string; type: string; url?: string; code?: string; workflowId?: number }[]) ?? []);
      const memKey = str(params.memoryKey || "default");
      const toolDesc = tools.map((t) => `- ${t.name}: ${t.description} (type=${t.type})`).join("\n");
      const system = `${str(params.systemPrompt)}\n\nYou can use tools. To call a tool respond ONLY with JSON: {"tool":"<name>","input":"<string>"}. When you have the final answer respond with JSON: {"final":"<answer>"}.\nTools:\n${toolDesc || "(none)"}`;
      const history = memory.get(memKey);
      const msgs: ChatMessage[] = [{ role: "system", content: system }, ...history, { role: "user", content: str(params.prompt) }];
      const steps: unknown[] = []; let final = ""; let simulated = false;
      const cfg = { provider, model: str(params.model), apiKey: resolveApiKey(provider, credential), baseUrl: credential.baseUrl, temperature: num(params.temperature, 0.3) };
      for (let it = 0; it < num(params.maxIterations, 5); it++) {
        const r = await chat(cfg, msgs);
        if (r.simulated) { simulated = true; final = r.text; break; }
        const parsed = parseMaybeJson(r.text.trim().replace(/^```json|```$/g, "").trim()) as { tool?: string; input?: string; final?: string } | string;
        if (typeof parsed === "object" && parsed.tool) {
          const tool = tools.find((t) => t.name === parsed.tool);
          let result = `Tool "${parsed.tool}" not found`;
          try {
            if (tool?.type === "http") { const res = await doFetch(tool.url ?? str(parsed.input), { method: "GET" }, {}); result = str(res.body).slice(0, 4000); }
            else if (tool?.type === "js") { result = str(new Function("input", tool.code ?? "return eval(input)")(parsed.input)); }
            else if (tool?.type === "subworkflow" && tool.workflowId) { const res = await runSubWorkflow(tool.workflowId, [{ json: { input: parsed.input } }]); result = JSON.stringify(res.map((x) => x.json)).slice(0, 4000); }
          } catch (e) { result = `Tool error: ${(e as Error).message}`; }
          steps.push({ tool: parsed.tool, input: parsed.input, result }); log("info", `Agent → tool ${parsed.tool}`);
          msgs.push({ role: "assistant", content: r.text }, { role: "user", content: `Tool result: ${result}` });
        } else { final = typeof parsed === "object" ? parsed.final ?? r.text : r.text; break; }
      }
      memory.append(memKey, [{ role: "user", content: str(params.prompt) }, { role: "assistant", content: final }]);
      out.push({ json: { ...(items[i]?.json ?? {}), output: final, steps, memoryKey: memKey, simulated } });
    }
    return { main: out };
  },

  async aiMemory({ items, p }) {
    const params = p(0); const key = str(params.memoryKey || "default");
    if (params.operation === "clear") { memory.clear(key); return { main: [{ json: { cleared: key } }] }; }
    return { main: [{ json: { ...(items[0]?.json ?? {}), memory: memory.get(key) } }] };
  },

  async embeddings({ items, p, credential }) {
    const out: Item[] = [];
    for (let i = 0; i < items.length; i++) { const params = p(i); const provider = str(params.provider || "local"); const v = await embed(provider, str(params.model), str(params.text), resolveApiKey(provider, credential)); out.push({ json: { ...items[i].json, embedding: v, dimensions: v.length } }); }
    return { main: out };
  },
  async textSplitter({ items, p }) {
    const out: Item[] = [];
    items.forEach((it, i) => { const params = p(i); const t = str(params.text); const size = Math.max(50, num(params.chunkSize, 500)); const ov = num(params.overlap, 50); for (let s = 0; s < t.length; s += size - ov) { out.push({ json: { ...it.json, text: t.slice(s, s + size), chunkIndex: out.length } }); if (s + size >= t.length) break; } });
    return { main: out };
  },
  async documentLoader({ items, p, credential }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i); const src = str(params.source || "file"); const ref = str(params.path); let text = "";
      if (src === "url") text = str((await doFetch(ref, { method: "GET" }, credential)).body).replace(/<[^>]+>/g, " ");
      else if (src === "field") text = str(items[i]?.json?.[ref]);
      else text = await fs.readFile(safePath(ref), "utf8");
      out.push({ json: { source: ref, text, length: text.length } }); }
    return { main: out };
  },
  async vectorStore({ items, p, credential, log }) {
    const params = p(0); const col = str(params.collection || "knowledge"); const op = str(params.operation || "insert"); const provider = str(params.provider || "local");
    if (provider !== "local") log("info", `Vector provider ${provider}: از حافظه لوکال به‌عنوان cache استفاده می‌شود`);
    if (op === "clear") { vectorStore.clear(col); return { main: [{ json: { cleared: col } }] }; }
    if (op === "insert") { const docs = []; for (const it of items) { const text = str(it.json.text ?? JSON.stringify(it.json)); const vector = Array.isArray(it.json.embedding) ? (it.json.embedding as number[]) : await embed("local", "", text); docs.push({ text, vector, metadata: it.json }); } const total = vectorStore.insert(col, docs); return { main: [{ json: { collection: col, inserted: docs.length, total } }] }; }
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) { const q = str(p(i).query); const qv = await embed("local", "", q); const res = vectorStore.search(col, qv, num(params.topK, 4)); out.push({ json: { ...(items[i]?.json ?? {}), query: q, matches: res } }); }
    void credential;
    return { main: out };
  },
  async ragChain({ items, p, credential, log }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i); const q = str(params.question); const col = str(params.collection || "knowledge");
      const matches = vectorStore.search(col, await embed("local", "", q), num(params.topK, 4));
      const context = matches.map((m, k) => `[${k + 1}] ${m.text}`).join("\n\n");
      const provider = str(params.provider || "openai");
      const r = await chat({ provider, model: str(params.model), apiKey: resolveApiKey(provider, credential), baseUrl: credential.baseUrl }, [{ role: "system", content: "Answer using ONLY the context. If unknown say so. Reply in the user's language." }, { role: "user", content: `Context:\n${context}\n\nQuestion: ${q}` }]);
      if (r.simulated) log("warn", "RAG: LLM شبیه‌سازی شد؛ فقط retrieval انجام شد");
      out.push({ json: { question: q, answer: r.simulated ? (matches[0]?.text ?? "هیچ سندی یافت نشد") : r.text, sources: matches, simulated: r.simulated ?? false } }); }
    return { main: out };
  },
  async guardrails({ items, p }) {
    const pass: Item[] = [], blocked: Item[] = [];
    items.forEach((it, i) => { const params = p(i); const t = str(params.text); const reasons: string[] = [];
      const words = str(params.blockedWords).split(",").map((w) => w.trim()).filter(Boolean); for (const w of words) if (t.toLowerCase().includes(w.toLowerCase())) reasons.push(`blocked word: ${w}`);
      if (t.length > num(params.maxLength, 5000)) reasons.push("too long");
      if (params.blockPII && (/\b\d{16}\b/.test(t) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(t) || /\b09\d{9}\b/.test(t))) reasons.push("PII detected");
      (reasons.length ? blocked : pass).push({ json: { ...it.json, guardrails: { passed: !reasons.length, reasons } } }); });
    return { pass, blocked };
  },
  async sentiment({ items, p }) {
    const pos = ["خوب", "عالی", "ممنون", "great", "good", "love", "excellent", "happy", "thanks", "perfect"], neg = ["بد", "افتضاح", "مشکل", "خطا", "bad", "terrible", "hate", "error", "angry", "worst"];
    return { main: items.map((it, i) => { const t = str(p(i).text).toLowerCase(); const s = pos.filter((w) => t.includes(w)).length - neg.filter((w) => t.includes(w)).length; return { json: { ...it.json, sentiment: s > 0 ? "positive" : s < 0 ? "negative" : "neutral", score: s } }; }) };
  },
  async textClassifier({ items, p }) {
    return { main: items.map((it, i) => { const params = p(i); const cats = (parseMaybeJson(params.categories) ?? {}) as Record<string, string[]>; const t = str(params.text).toLowerCase(); let best = "other", bs = 0; for (const [c, kws] of Object.entries(cats)) { const sc = kws.filter((k) => t.includes(k.toLowerCase())).length; if (sc > bs) { bs = sc; best = c; } } return { json: { ...it.json, category: best, confidence: bs } }; }) };
  },

  // ------------------------------- Messaging ------------------------------
  async bale({ items, p, credential, log }) {
    return botApi("https://tapi.bale.ai/bot", items, p, credential, log, "Bale");
  },
  async telegram({ items, p, credential, log }) {
    return botApi("https://api.telegram.org/bot", items, p, credential, log, "Telegram");
  },
  async soroush({ items, p, credential, log }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i); const token = credential.botToken;
      if (!token) { log("warn", "Soroush: توکن تنظیم نشده – شبیه‌سازی"); out.push({ json: { simulated: true, platform: "soroush", ...params } }); continue; }
      const base = `https://bot.splus.ir/${token}`; const op = str(params.operation || "sendMessage");
      const body = op === "sendFile" ? { to: params.chatId, url: params.fileUrl, caption: params.text } : { to: params.chatId, body: params.text };
      const res = await doFetch(`${base}/${op === "getUpdates" ? "getUpdates" : op === "sendFile" ? "sendFile" : "sendMessage"}`, { method: op === "getUpdates" ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: op === "getUpdates" ? undefined : JSON.stringify(body) }, {});
      out.push({ json: { statusCode: res.status, result: res.body } }); }
    return { main: out };
  },
  async slack({ items, p, credential, log }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i);
      if (credential.webhookUrl) { const res = await doFetch(credential.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: params.text, channel: params.channel }) }, {}); out.push({ json: { statusCode: res.status, result: res.body } }); }
      else if (credential.botToken) { const res = await doFetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: params.channel, text: params.text }) }, { token: credential.botToken }); out.push({ json: res.body as Record<string, unknown> }); }
      else { log("warn", "Slack: credential تنظیم نشده – شبیه‌سازی"); out.push({ json: { simulated: true, ...params } }); } }
    return { main: out };
  },
  async discord({ items, p, credential, log }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i); const url = str(params.webhookUrl || credential.webhookUrl);
      if (!url) { log("warn", "Discord: Webhook URL تنظیم نشده – شبیه‌سازی"); out.push({ json: { simulated: true, ...params } }); continue; }
      const res = await doFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: params.content }) }, {}); out.push({ json: { statusCode: res.status } }); }
    return { main: out };
  },
  async sendEmail({ items, p, credential, log }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i);
      if (!credential.host) { log("warn", "SMTP تنظیم نشده – ایمیل شبیه‌سازی شد"); out.push({ json: { simulated: true, to: params.to, subject: params.subject, html: params.html } }); continue; }
      // ارسال با SMTP خام (بدون وابستگی خارجی) – STARTTLS پشتیبانی نمی‌شود؛ برای TLS از پورت 465 یا relay لوکال استفاده کنید
      const r = await smtpSend(credential, str(params.to), str(params.subject), str(params.html)); out.push({ json: { to: params.to, subject: params.subject, ...r } }); }
    return { main: out };
  },

  // -------------------------------- Database ------------------------------
  async postgres({ items, p, credential }) {
    const cs = credential.connectionString || process.env.DATABASE_URL!;
    const pool = new Pool({ connectionString: cs, max: 2 });
    try {
      const out: Item[] = [];
      for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i); const op = str(params.operation || "query");
        let sqlText = str(params.query); let values = (parseMaybeJson(params.params) as unknown[]) ?? [];
        if (op === "insert") { const row = items[i]?.json ?? {}; const keys = Object.keys(row); sqlText = `INSERT INTO ${str(params.table)} (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys.map((_, j) => `$${j + 1}`).join(",")}) RETURNING *`; values = keys.map((k) => row[k]); }
        if (op === "select") sqlText = `SELECT * FROM ${str(params.table)} LIMIT 100`;
        const r = await pool.query(sqlText, values as unknown[]);
        if (r.rows.length) out.push(...r.rows.map((row) => ({ json: row as Record<string, unknown> }))); else out.push({ json: { rowCount: r.rowCount, command: r.command } }); }
      return { main: out };
    } finally { await pool.end(); }
  },

  // ---------------------------------- IoT ---------------------------------
  async tcp({ items, p }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i);
      const r = await new Promise<Record<string, unknown>>((resolve, reject) => { const sock = new net.Socket(); let data = ""; const to = setTimeout(() => { sock.destroy(); resolve({ sent: true, response: data, timeout: true }); }, num(params.timeout, 5000));
        sock.connect(num(params.port, 9000), str(params.host || "127.0.0.1"), () => { sock.write(str(params.data)); if (!params.waitForResponse) { clearTimeout(to); sock.end(); resolve({ sent: true }); } });
        sock.on("data", (d) => { data += d.toString(); clearTimeout(to); sock.end(); resolve({ sent: true, response: data }); }); sock.on("error", (e) => { clearTimeout(to); reject(e); }); sock.on("close", () => { clearTimeout(to); resolve({ sent: true, response: data }); }); });
      out.push({ json: r }); }
    return { main: out };
  },
  async udp({ items, p }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i); const sock = dgram.createSocket("udp4"); const msg = Buffer.from(str(params.data));
      await new Promise<void>((resolve, reject) => sock.send(msg, num(params.port, 9001), str(params.host || "127.0.0.1"), (e) => { sock.close(); e ? reject(e) : resolve(); }));
      out.push({ json: { sent: true, bytes: msg.length, host: params.host, port: params.port } }); }
    return { main: out };
  },
  async mqtt({ items, p, credential, log }) {
    // پیاده‌سازی MQTT 3.1.1 حداقلی روی TCP (CONNECT + PUBLISH) بدون وابستگی خارجی
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i); const url = new URL(str(params.brokerUrl || credential.brokerUrl || "mqtt://localhost:1883"));
      if (params.operation === "subscribeOnce") { log("warn", "MQTT subscribe در نود تریگر (MQTT Trigger) پشتیبانی می‌شود"); out.push({ json: { subscribed: params.topic, note: "use MQTT Trigger" } }); continue; }
      const r = await mqttPublish(url.hostname, Number(url.port || 1883), str(params.topic), str(params.message), credential.username, credential.password); out.push({ json: { published: true, topic: params.topic, ...r } }); }
    return { main: out };
  },
  async websocket({ items, p }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i);
      const r = await new Promise<Record<string, unknown>>((resolve, reject) => { const ws = new WebSocket(str(params.url)); const to = setTimeout(() => { ws.close(); resolve({ sent: true, timeout: true }); }, num(params.timeout, 5000));
        ws.onopen = () => { ws.send(str(params.message)); if (!params.waitForResponse) { clearTimeout(to); ws.close(); resolve({ sent: true }); } };
        ws.onmessage = (ev) => { clearTimeout(to); ws.close(); resolve({ sent: true, response: parseMaybeJson(String(ev.data)) }); }; ws.onerror = () => { clearTimeout(to); reject(new Error("WebSocket error")); }; });
      out.push({ json: r }); }
    return { main: out };
  },
  async modbus({ items, p }) {
    // Modbus TCP خام (MBAP + PDU) بدون وابستگی
    const out: Item[] = [];
    const FC: Record<string, number> = { readCoils: 1, readDiscrete: 2, readHolding: 3, readInput: 4, writeCoil: 5, writeRegister: 6 };
    for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i); const fc = FC[str(params.function || "readHolding")] ?? 3; const addr = num(params.address); const qty = num(params.quantity, 2); const val = num(params.value);
      const pdu = Buffer.alloc(5); pdu.writeUInt8(fc, 0); pdu.writeUInt16BE(addr, 1); pdu.writeUInt16BE(fc === 5 ? (val ? 0xff00 : 0) : fc === 6 ? val : qty, 3);
      const mbap = Buffer.alloc(7); mbap.writeUInt16BE(1, 0); mbap.writeUInt16BE(0, 2); mbap.writeUInt16BE(pdu.length + 1, 4); mbap.writeUInt8(num(params.unitId, 1), 6);
      const resp = await new Promise<Buffer>((resolve, reject) => { const s = new net.Socket(); const to = setTimeout(() => { s.destroy(); reject(new Error("Modbus timeout")); }, 5000); s.connect(num(params.port, 502), str(params.host), () => s.write(Buffer.concat([mbap, pdu]))); s.on("data", (d) => { clearTimeout(to); s.end(); resolve(d); }); s.on("error", (e) => { clearTimeout(to); reject(e); }); });
      const body = resp.subarray(7); const rfc = body.readUInt8(0);
      if (rfc & 0x80) throw new Error(`Modbus exception code ${body.readUInt8(1)}`);
      let values: number[] = [];
      if (rfc <= 2) { const n = body.readUInt8(1); const bits: number[] = []; for (let b = 0; b < n; b++) for (let k = 0; k < 8; k++) bits.push((body.readUInt8(2 + b) >> k) & 1); values = bits.slice(0, qty); }
      else if (rfc <= 4) { const n = body.readUInt8(1) / 2; for (let k = 0; k < n; k++) values.push(body.readUInt16BE(2 + k * 2)); }
      else values = [body.readUInt16BE(3)];
      out.push({ json: { function: params.function, address: addr, values } }); }
    return { main: out };
  },
  async s3({ items, p, credential, log }) {
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) { const params = p(i);
      if (!credential.accessKey) { log("warn", "S3 credential تنظیم نشده – شبیه‌سازی"); out.push({ json: { simulated: true, ...params } }); continue; }
      const r = await s3Request(credential, str(params.operation || "list"), str(params.bucket), str(params.key), str(params.content)); out.push({ json: r }); }
    return { main: out };
  },
  async logStream({ items, p, log }) {
    const params = p(0); const dest = str(params.destination || "console"); const msg = str(params.message);
    log((str(params.level) as "info") || "info", `[LogStream→${dest}] ${msg.slice(0, 500)}`);
    if (dest !== "console" && params.url) { await doFetch(str(params.url), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: params.level, message: msg, ts: new Date().toISOString(), source: "flowforge" }) }, {}).catch((e) => log("warn", `LogStream failed: ${e.message}`)); }
    return { main: items };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function botApi(base: string, items: Item[], p: HandlerCtx["p"], cred: Record<string, string>, log: HandlerCtx["log"], name: string): Promise<HandlerOutput> {
  const out: Item[] = [];
  for (let i = 0; i < Math.max(items.length, 1); i++) {
    const params = p(i); const token = cred.botToken || (name === "Telegram" ? process.env.TELEGRAM_BOT_TOKEN : process.env.BALE_BOT_TOKEN);
    if (!token) { log("warn", `${name}: توکن ربات تنظیم نشده – شبیه‌سازی`); out.push({ json: { simulated: true, platform: name.toLowerCase(), ...params } }); continue; }
    const op = str(params.operation || "sendMessage");
    let body: Record<string, unknown> = { chat_id: params.chatId, text: params.text, parse_mode: params.parseMode };
    if (op === "sendPhoto") body = { chat_id: params.chatId, photo: params.fileUrl, caption: params.text };
    if (op === "sendDocument") body = { chat_id: params.chatId, document: params.fileUrl, caption: params.text };
    if (op === "setWebhook") body = { url: params.fileUrl || params.text };
    const res = await doFetch(`${base}${token}/${op}`, { method: op === "getUpdates" ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: op === "getUpdates" ? undefined : JSON.stringify(body) }, {});
    if (!res.ok) log("warn", `${name} API ${res.status}: ${str(res.body).slice(0, 200)}`);
    out.push({ json: { statusCode: res.status, ...(typeof res.body === "object" && res.body ? (res.body as Record<string, unknown>) : { body: res.body }) } });
  }
  return { main: out };
}

/** ارسال MQTT PUBLISH (QoS 0) روی TCP خام */
function mqttPublish(host: string, port: number, topic: string, message: string, user?: string, pass?: string) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const s = new net.Socket(); const to = setTimeout(() => { s.destroy(); reject(new Error("MQTT timeout")); }, 5000);
    const enc = (b: string) => { const buf = Buffer.from(b); return Buffer.concat([Buffer.from([buf.length >> 8, buf.length & 255]), buf]); };
    const remLen = (n: number) => { const b: number[] = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; b.push(d); } while (n > 0); return Buffer.from(b); };
    let flags = 0x02; const payload: Buffer[] = [enc("MQTT"), Buffer.from([4]), Buffer.alloc(1), Buffer.from([0, 60]), enc(`ff-${Date.now()}`)];
    if (user) { flags |= 0x80; payload.push(enc(user)); } if (pass) { flags |= 0x40; payload.push(enc(pass)); }
    payload[2] = Buffer.from([flags]);
    const varHeader = Buffer.concat(payload); const connect = Buffer.concat([Buffer.from([0x10]), remLen(varHeader.length), varHeader]);
    s.connect(port, host, () => s.write(connect));
    s.once("data", (d) => { if (d[0] !== 0x20 || d[3] !== 0) { clearTimeout(to); s.destroy(); return reject(new Error(`MQTT CONNACK code ${d[3]}`)); }
      const pub = Buffer.concat([enc(topic), Buffer.from(message)]); s.write(Buffer.concat([Buffer.from([0x30]), remLen(pub.length), pub]));
      s.write(Buffer.from([0xe0, 0])); setTimeout(() => { clearTimeout(to); s.end(); resolve({ broker: `${host}:${port}`, bytes: message.length }); }, 100); });
    s.on("error", (e) => { clearTimeout(to); reject(e); });
  });
}

/** ارسال SMTP ساده (بدون TLS، مناسب relay لوکال مثل Mailpit/Postfix) */
function smtpSend(cred: Record<string, string>, to: string, subject: string, html: string) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const s = net.createConnection(Number(cred.port || 25), cred.host); const from = cred.from || cred.user || "flowforge@localhost";
    const steps = [`EHLO flowforge`, ...(cred.user ? [`AUTH LOGIN`, Buffer.from(cred.user).toString("base64"), Buffer.from(cred.password ?? "").toString("base64")] : []), `MAIL FROM:<${from}>`, `RCPT TO:<${to}>`, `DATA`, `From: ${from}\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n.`, `QUIT`];
    let i = 0; const log: string[] = []; const to_ = setTimeout(() => { s.destroy(); reject(new Error("SMTP timeout")); }, 15000);
    s.on("data", (d) => { log.push(d.toString().trim()); if (/^[45]\d\d/.test(d.toString())) { clearTimeout(to_); s.end(); return reject(new Error(d.toString())); } if (i < steps.length) s.write(steps[i++] + "\r\n"); else { clearTimeout(to_); s.end(); resolve({ sent: true, log }); } });
    s.on("error", (e) => { clearTimeout(to_); reject(e); });
  });
}

/** درخواست S3 با امضای AWS SigV4 (بدون SDK) */
async function s3Request(cred: Record<string, string>, op: string, bucket: string, key: string, content: string) {
  const endpoint = (cred.endpoint || "http://localhost:9000").replace(/\/$/, ""); const region = cred.region || "us-east-1"; const url = new URL(endpoint);
  const method = op === "put" ? "PUT" : op === "delete" ? "DELETE" : "GET";
  const pathName = op === "list" ? `/${bucket}` : `/${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
  const now = new Date(); const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); const date = amz.slice(0, 8);
  const body = op === "put" ? content : ""; const payloadHash = crypto.createHash("sha256").update(body).digest("hex");
  const headers: Record<string, string> = { host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amz };
  const signedHeaders = Object.keys(headers).sort().join(";"); const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k}:${headers[k]}\n`).join("");
  const canonical = [method, pathName, op === "list" ? "list-type=2" : "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${date}/${region}/s3/aws4_request`; const sts = ["AWS4-HMAC-SHA256", amz, scope, crypto.createHash("sha256").update(canonical).digest("hex")].join("\n");
  const hmac = (k: Buffer | string, d: string) => crypto.createHmac("sha256", k).update(d).digest();
  const sig = crypto.createHmac("sha256", hmac(hmac(hmac(hmac("AWS4" + cred.secretKey, date), region), "s3"), "aws4_request")).update(sts).digest("hex");
  const res = await fetch(`${endpoint}${pathName}${op === "list" ? "?list-type=2" : ""}`, { method, headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${cred.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}` }, body: op === "put" ? body : undefined });
  const text = await res.text();
  if (op === "list") return { statusCode: res.status, keys: [...text.matchAll(/<Key>(.*?)<\/Key>/g)].map((m) => m[1]) };
  return { statusCode: res.status, body: text.slice(0, 10000) };
}

/** اجرای دستور خارجی (برای استفاده در Worker/Instrumentation) */
export { spawn, resolveParams };
