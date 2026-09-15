// ============================================================================
// Workflow Executor – موتور اجرای جریان‌ها
// - مرتب‌سازی توپولوژیک، شاخه‌ها (If/Switch)، حلقه (Loop با back-edge)
// - Merge با چند ورودی، Sub-workflow، Error Workflow، ذخیره تاریخچه اجرا
// ============================================================================
import { db } from "@/db";
import { executions, workflows, type Workflow, type WorkflowNode, type WorkflowEdge, type ExecutionResult, type NodeRunResult, type ExecutionLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadNodeRegistry } from "@/lib/server/node-registry";
import { executeCustomNode } from "./custom-node";
import { handlers, type HandlerCtx, type HandlerOutput } from "./handlers";
import { type Item, type ExprContext, resolveParams } from "./expressions";
import { loadCredential, loadVariables } from "@/lib/server/utils";

export type ExecuteOptions = {
  mode?: string;
  triggerData?: unknown;
  startNodeId?: string;
  depth?: number;
  save?: boolean;
  /** فقط تا این نود اجرا شود (برای اجرای جزئی در ویرایشگر) */
  untilNodeId?: string;
};

export type ExecuteResult = {
  executionId: number | null;
  status: "success" | "error";
  error?: string;
  result: ExecutionResult;
  respond?: { statusCode: number; body: unknown };
  lastOutput: Item[];
  durationMs: number;
};

const MAX_DEPTH = 5;
const MAX_STORED_ITEMS = 200;

// وضعیت سراسری برای Worker View
const g = globalThis as typeof globalThis & { __ffRunning?: Map<number, { workflowId: number; startedAt: number }> };
g.__ffRunning ??= new Map();
export const runningExecutions = g.__ffRunning;

/** اجرای یک Workflow کامل */
export async function executeWorkflow(wf: Workflow, opts: ExecuteOptions = {}): Promise<ExecuteResult> {
  const started = Date.now();
  const depth = opts.depth ?? 0;
  const logs: ExecutionLog[] = [];
  const nodeResults: Record<string, NodeRunResult> = {};
  const log = (level: ExecutionLog["level"], message: string, nodeId?: string) => {
    logs.push({ ts: new Date().toISOString(), level, nodeId, message });
    if (logs.length > 2000) logs.shift();
  };

  // ایجاد رکورد اجرا
  let executionId: number | null = null;
  const save = opts.save ?? wf.settings?.saveExecutions ?? true;
  if (save) {
    const [row] = await db
      .insert(executions)
      .values({ workflowId: wf.id, workflowName: wf.name, status: "running", mode: opts.mode ?? "manual", triggerData: (opts.triggerData as object) ?? {} })
      .returning({ id: executions.id });
    executionId = row.id;
    runningExecutions.set(executionId, { workflowId: wf.id, startedAt: started });
  }

  const vars = await loadVariables();
  const registry = await loadNodeRegistry();
  const definitions = new Map(registry.catalog.map(d => [d.type, d]));
  const getNodeDef = (type: string) => {
    const def = definitions.get(type);
    if (!def) throw new Error(`Node type is not installed: ${type}`);
    return def;
  };
  const nodes = (wf.nodes ?? []).filter((n) => !n.disabled);
  const edges = (wf.edges ?? []).filter((e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outputs = new Map<string, HandlerOutput>(); // nodeId → خروجی به تفکیک هندل
  const nodeOutputsByName: Record<string, Item[]> = {};
  let respond: ExecuteResult["respond"];
  let lastOutput: Item[] = [];
  let status: "success" | "error" = "success";
  let errorMsg: string | undefined;

  log("info", `شروع اجرای "${wf.name}" (mode=${opts.mode ?? "manual"})`);

  try {
    // ---------------- تعیین نودهای شروع ----------------
    let startIds: string[];
    if (opts.startNodeId && nodeById.has(opts.startNodeId)) startIds = [opts.startNodeId];
    else {
      const triggers = nodes.filter((n) => getNodeDef(n.type).trigger);
      startIds = triggers.length ? triggers.map((n) => n.id) : nodes.filter((n) => !edges.some((e) => e.target === n.id)).map((n) => n.id);
    }
    if (!startIds.length) throw new Error("هیچ نود شروع/تریگری در جریان وجود ندارد");

    // ---------------- شناسایی حلقه‌ها و back-edge ها ----------------
    const loopNodes = nodes.filter((n) => n.type === "loop");
    const loopBodies = new Map<string, Set<string>>();
    const backEdges = new Set<string>();
    for (const ln of loopNodes) {
      const body = new Set<string>();
      const stack = edges.filter((e) => e.source === ln.id && (e.sourceHandle ?? "main") === "loop").map((e) => e.target);
      while (stack.length) {
        const id = stack.pop()!;
        if (id === ln.id || body.has(id)) continue;
        body.add(id);
        for (const e of edges.filter((e) => e.source === id)) {
          if (e.target === ln.id) backEdges.add(e.id);
          else stack.push(e.target);
        }
      }
      loopBodies.set(ln.id, body);
    }
    const dagEdges = edges.filter((e) => !backEdges.has(e.id));

    // ---------------- مرتب‌سازی توپولوژیک از نودهای شروع ----------------
    const reachable = new Set<string>();
    const st = [...startIds];
    while (st.length) {
      const id = st.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      dagEdges.filter((e) => e.source === id).forEach((e) => st.push(e.target));
    }
    const order = topoSort([...reachable], dagEdges.filter((e) => reachable.has(e.source) && reachable.has(e.target)));

    // ---------------- اجرای یک نود ----------------
    const runNode = async (node: WorkflowNode, items: Item[]): Promise<HandlerOutput> => {
      const def = getNodeDef(node.type);
      const handler = handlers[def.handler] ?? handlers.noop;
      const credential = await loadCredential(node.credentialId);
      const nodeStarted = Date.now();
      const isStart = startIds.includes(node.id);
      const ctx: HandlerCtx = {
        node,
        def,
        items,
        nodeOutputs: nodeOutputsByName,
        vars,
        credential,
        executionId: executionId ?? undefined,
        workflowId: wf.id,
        workflowName: wf.name,
        triggerData: isStart && def.trigger ? opts.triggerData : undefined,
        log: (level, message) => log(level, message, node.id),
        runSubWorkflow: async (id, input) => {
          if (depth >= MAX_DEPTH) throw new Error("حداکثر عمق Sub-workflow");
          const [sub] = await db.select().from(workflows).where(eq(workflows.id, id));
          if (!sub) throw new Error(`Workflow #${id} یافت نشد`);
          const r = await executeWorkflow(sub, { mode: "subworkflow", triggerData: input.map((i) => i.json), depth: depth + 1 });
          if (r.status === "error") throw new Error(`Sub-workflow error: ${r.error}`);
          return r.lastOutput;
        },
        p: (i = 0) => {
          const item = items[i] ?? items[0] ?? { json: {} };
          const ectx: ExprContext = { item, index: i, items, nodeOutputs: nodeOutputsByName, vars, executionId: executionId ?? undefined, workflowId: wf.id, workflowName: wf.name };
          return resolveParams(node.parameters ?? {}, ectx);
        },
      };
      try {
        const custom = registry.specs.get(node.type);
        const out = custom ? await executeCustomNode(custom, { items, params: ctx.p(0), credential, vars }) : await handler(ctx);
        const all = Object.values(out).flat();
        nodeResults[node.id] = { status: "success", output: all.slice(0, MAX_STORED_ITEMS).map((i) => i.json), durationMs: Date.now() - nodeStarted, startedAt: new Date(nodeStarted).toISOString() };
        nodeOutputsByName[node.name] = all;
        if (all.length) lastOutput = all;
        if (node.type === "respondToWebhook" && all[0]?.json.__respond) respond = { statusCode: Number(all[0].json.statusCode), body: all[0].json.body };
        log("info", `✓ ${node.name} → ${all.length} آیتم (${Date.now() - nodeStarted}ms)`, node.id);
        return out;
      } catch (e) {
        const msg = (e as Error).message;
        nodeResults[node.id] = { status: "error", output: [], error: msg, durationMs: Date.now() - nodeStarted, startedAt: new Date(nodeStarted).toISOString() };
        log("error", `✗ ${node.name}: ${msg}`, node.id);
        if (node.parameters?.continueOnFail === true) return { main: items.map((i) => ({ json: { ...i.json, error: msg } })) };
        throw new Error(`[${node.name}] ${msg}`);
      }
    };

    // جمع‌آوری ورودی‌های یک نود از edgeها
    const collectInputs = (node: WorkflowNode, edgeSet: WorkflowEdge[]): { items: Item[]; hasIncoming: boolean } => {
      const incoming = edgeSet.filter((e) => e.target === node.id);
      const def = getNodeDef(node.type);
      const items: Item[] = [];
      for (const e of incoming) {
        const src = outputs.get(e.source);
        if (!src) continue;
        const handle = e.sourceHandle ?? "main";
        const arr = src[handle] ?? (handle === "main" ? Object.values(src)[0] ?? [] : []);
        const inputIndex = def.inputs > 1 ? Number(e.targetHandle?.replace(/\D/g, "") || 0) : undefined;
        for (const it of arr) items.push(inputIndex !== undefined ? { json: { ...it.json, __inputIndex: inputIndex } } : it);
      }
      return { items, hasIncoming: incoming.length > 0 };
    };

    // ---------------- حلقه اصلی اجرا ----------------
    const executed = new Set<string>();
    const allBodies = new Set([...loopBodies.values()].flatMap((s) => [...s]));

    for (const id of order) {
      if (executed.has(id) || allBodies.has(id)) continue;
      const node = nodeById.get(id)!;
      const { items, hasIncoming } = collectInputs(node, dagEdges);
      if (hasIncoming && !items.length && !startIds.includes(id)) {
        nodeResults[id] = { status: "skipped", output: [], durationMs: 0, startedAt: new Date().toISOString() };
        continue;
      }

      if (node.type === "loop") {
        // ---- اجرای حلقه: هر دسته → بدنه → جمع‌آوری نتیجه از back-edge ----
        const body = loopBodies.get(id)!;
        const bodyOrder = order.filter((x) => body.has(x));
        const size = Math.max(1, Number(node.parameters?.batchSize ?? 1));
        const done: Item[] = [];
        const backSources = edges.filter((e) => backEdges.has(e.id) && e.target === id).map((e) => e.source);
        for (let b = 0; b < items.length; b += size) {
          const batch = items.slice(b, b + size);
          outputs.set(id, { loop: batch, done: [] });
          log("debug", `Loop دسته ${b / size + 1}/${Math.ceil(items.length / size)}`, id);
          for (const bid of bodyOrder) {
            const bn = nodeById.get(bid)!;
            const inp = collectInputs(bn, dagEdges);
            if (inp.hasIncoming && !inp.items.length) { outputs.set(bid, {}); continue; }
            outputs.set(bid, await runNode(bn, inp.items));
          }
          for (const s of backSources) done.push(...Object.values(outputs.get(s) ?? {}).flat());
          if (!backSources.length) done.push(...batch);
          if (items.length === 0) break;
        }
        if (!items.length) { for (const bid of bodyOrder) nodeResults[bid] = { status: "skipped", output: [], durationMs: 0, startedAt: new Date().toISOString() }; }
        outputs.set(id, { loop: [], done });
        nodeResults[id] = { status: "success", output: done.slice(0, MAX_STORED_ITEMS).map((i) => i.json), durationMs: 0, startedAt: new Date().toISOString() };
        nodeOutputsByName[node.name] = done;
        lastOutput = done;
        executed.add(id);
        body.forEach((x) => executed.add(x));
        continue;
      }

      outputs.set(id, await runNode(node, items));
      executed.add(id);
      if (opts.untilNodeId && id === opts.untilNodeId) break;
    }
    log("info", `اجرا با موفقیت پایان یافت (${Date.now() - started}ms)`);
  } catch (e) {
    status = "error";
    errorMsg = (e as Error).message;
    log("error", errorMsg);
  }

  const durationMs = Date.now() - started;
  const result: ExecutionResult = { nodes: nodeResults, logs };

  if (executionId) {
    await db.update(executions).set({ status, result, error: errorMsg ?? null, finishedAt: new Date(), durationMs }).where(eq(executions.id, executionId));
    runningExecutions.delete(executionId);
  }

  // ---------------- Error Workflow ----------------
  if (status === "error" && wf.settings?.errorWorkflowId && depth < MAX_DEPTH && opts.mode !== "error") {
    const [ew] = await db.select().from(workflows).where(eq(workflows.id, wf.settings.errorWorkflowId));
    if (ew) {
      executeWorkflow(ew, { mode: "error", depth: depth + 1, triggerData: { workflow: { id: wf.id, name: wf.name }, execution: { id: executionId, error: errorMsg, mode: opts.mode } } }).catch(() => {});
    }
  }

  return { executionId, status, error: errorMsg, result, respond, lastOutput, durationMs };
}

/** مرتب‌سازی توپولوژیک (Kahn) – نودهای موجود در چرخه در انتها اضافه می‌شوند */
function topoSort(ids: string[], edges: WorkflowEdge[]): string[] {
  const indeg = new Map(ids.map((id) => [id, 0]));
  for (const e of edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  const queue = ids.filter((id) => indeg.get(id) === 0);
  const out: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(id);
    for (const e of edges.filter((e) => e.source === id)) {
      indeg.set(e.target, indeg.get(e.target)! - 1);
      if (indeg.get(e.target) === 0) queue.push(e.target);
    }
  }
  for (const id of ids) if (!out.includes(id)) out.push(id);
  return out;
}

/** اجرای Workflow با شناسه */
export async function executeWorkflowById(id: number, opts: ExecuteOptions = {}) {
  const [wf] = await db.select().from(workflows).where(eq(workflows.id, id));
  if (!wf) throw new Error("Workflow not found");
  return executeWorkflow(wf, opts);
}
