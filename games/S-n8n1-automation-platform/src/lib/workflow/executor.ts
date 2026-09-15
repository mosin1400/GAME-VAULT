// ==========================================================================
// موتور اجرای Workflow (Execution Engine)
// پیمایش گراف نودها/یال‌ها، اجرای هر نود، مسیردهی شاخه‌ها (If/Switch) و
// ثبت کامل تاریخچه‌ی اجرا (Executions + Execution Logs) در پایگاه‌داده.
// ==========================================================================
import { db } from "@/db";
import { workflows, executions, executionLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getNodeDefinition } from "./registry";
import { getDecryptedCredential, getVariable } from "./credentialHelper";
import { resolveExpressionDeep, buildScope } from "./expression";
import type { FlowItem, WorkflowEdge, WorkflowNode } from "./types";

export interface RunResult {
  executionId: number;
  status: "success" | "error";
  items: FlowItem[];
  error?: string;
}

interface WorkflowRow {
  id: number;
  name: string;
  nodes: unknown;
  edges: unknown;
  errorWorkflowId: number | null;
}

function asNodes(raw: unknown): WorkflowNode[] {
  return Array.isArray(raw) ? (raw as WorkflowNode[]) : [];
}
function asEdges(raw: unknown): WorkflowEdge[] {
  return Array.isArray(raw) ? (raw as WorkflowEdge[]) : [];
}

/** پیدا کردن مناسب‌ترین نود شروع برای اجرای دستی */
export function findManualStartNode(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode | undefined {
  const withIncoming = new Set(edges.map((e) => e.target));
  return (
    nodes.find((n) => n.data.type === "manualTrigger") ||
    nodes.find((n) => !withIncoming.has(n.id) && !n.data.disabled) ||
    nodes[0]
  );
}

export async function runWorkflowGraph(
  workflow: WorkflowRow,
  startNodeId: string,
  initialItems: FlowItem[],
  mode: string,
): Promise<RunResult> {
  const nodes = asNodes(workflow.nodes);
  const edges = asEdges(workflow.edges);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const [execRow] = await db
    .insert(executions)
    .values({ workflowId: workflow.id, workflowName: workflow.name, status: "running", mode })
    .returning();
  const executionId = execRow.id;

  // --- محاسبه‌ی زیرگراف قابل‌دسترس از نود شروع (BFS) و in-degree داخل آن ---
  const reachable = new Set<string>([startNodeId]);
  const outgoing = new Map<string, WorkflowEdge[]>();
  const incoming = new Map<string, WorkflowEdge[]>();
  for (const e of edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e);
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target)!.push(e);
  }
  const queueBfs = [startNodeId];
  while (queueBfs.length) {
    const cur = queueBfs.shift()!;
    for (const e of outgoing.get(cur) ?? []) {
      if (!reachable.has(e.target)) {
        reachable.add(e.target);
        queueBfs.push(e.target);
      }
    }
  }

  const indegree = new Map<string, number>();
  for (const id of reachable) {
    const count = (incoming.get(id) ?? []).filter((e) => reachable.has(e.source)).length;
    indegree.set(id, count);
  }

  const nodeInputs = new Map<string, FlowItem[]>();
  nodeInputs.set(startNodeId, initialItems);

  const nodeOutputs = new Map<string, Record<string, FlowItem[]>>();
  const executionOrder: string[] = [];
  const ready: string[] = [startNodeId];
  const processed = new Set<string>();
  let lastItems: FlowItem[] = initialItems;
  let failed: string | undefined;

  while (ready.length && !failed) {
    const nodeId = ready.shift()!;
    if (processed.has(nodeId)) continue;
    processed.add(nodeId);
    executionOrder.push(nodeId);

    const node = nodeById.get(nodeId);
    if (!node) continue;
    const def = getNodeDefinition(node.data.type);
    const inputItems = nodeInputs.get(nodeId) ?? [];
    const startedAt = new Date();

    let outputMap: Record<string, FlowItem[]> = { main: inputItems };
    let logStatus: "success" | "error" | "skipped" = "success";
    let logError: string | null = null;

    const isStartNode = nodeId === startNodeId;
    if (node.data.disabled) {
      logStatus = "skipped";
      outputMap = { main: inputItems };
    } else if (!def || !def.execute) {
      logStatus = "skipped";
      outputMap = { main: inputItems };
    } else if (!isStartNode && inputItems.length === 0) {
      // بدون آیتم ورودی (مثلاً شاخه‌ی انتخاب‌نشده‌ی If/Switch) -> اجرا نشود
      logStatus = "skipped";
      outputMap = { main: [] };
    } else {
      try {
        const vars: Record<string, string> = {};
        const credential = await getDecryptedCredential(node.data.credentialId);
        const scope0 = buildScope(inputItems[0] ?? { json: {} }, 0, inputItems, vars);
        const resolvedParameters = resolveExpressionDeep(node.data.parameters ?? {}, scope0) as Record<string, unknown>;
        // پارامترهای متنی‌ای که خودشان دوباره در سطح آیتم resolve می‌شوند در execute هر نود انجام می‌شود
        const result = await def.execute({
          items: inputItems,
          parameters: { ...(node.data.parameters ?? {}), ...resolvedParameters },
          credential,
          getVariable,
          workflowId: workflow.id,
          executionId,
          nodeId,
          helpers: {
            resolveExpression: (template, item, index) => resolveExpressionDeep(template, buildScope(item, index, inputItems, vars)),
          },
        });
        outputMap = Array.isArray(result) ? { main: result } : (result as Record<string, FlowItem[]>);
        lastItems = outputMap.main ?? Object.values(outputMap)[0] ?? [];
      } catch (err) {
        logStatus = "error";
        logError = (err as Error).message;
        failed = nodeId;
        outputMap = { main: [] };
      }
    }

    nodeOutputs.set(nodeId, outputMap);
    await db.insert(executionLogs).values({
      executionId,
      nodeId,
      nodeName: node.data.name || node.data.type,
      nodeType: node.data.type,
      status: logStatus,
      input: inputItems as unknown as object,
      output: outputMap as unknown as object,
      error: logError,
      startedAt,
      finishedAt: new Date(),
      durationMs: Date.now() - startedAt.getTime(),
    });

    if (failed) break;

    for (const edge of outgoing.get(nodeId) ?? []) {
      if (!reachable.has(edge.target)) continue;
      const handle = edge.sourceHandle || "main";
      const items = outputMap[handle] ?? (handle === "main" ? outputMap.main ?? [] : []);
      const existing = nodeInputs.get(edge.target) ?? [];
      nodeInputs.set(edge.target, existing.concat(items));
      indegree.set(edge.target, (indegree.get(edge.target) ?? 1) - 1);
      if ((indegree.get(edge.target) ?? 0) <= 0 && !processed.has(edge.target)) {
        ready.push(edge.target);
      }
    }
  }

  const status: "success" | "error" = failed ? "error" : "success";
  await db
    .update(executions)
    .set({
      status,
      finishedAt: new Date(),
      durationMs: Date.now() - execRow.startedAt.getTime(),
      error: failed ? { nodeId: failed } : null,
      resultData: lastItems as unknown as object,
    })
    .where(eq(executions.id, executionId));

  // --- Error Workflow: در صورت شکست، Workflow خطا (در صورت تنظیم) اجرا شود ---
  if (failed && workflow.errorWorkflowId) {
    try {
      await runWorkflowById(
        workflow.errorWorkflowId,
        [{ json: { failedWorkflowId: workflow.id, executionId, nodeId: failed } }],
        "error",
      );
    } catch {
      /* از شکست recursive جلوگیری می‌کنیم */
    }
  }

  return { executionId, status, items: lastItems, error: failed ? `اجرا در نود «${failed}» متوقف شد` : undefined };
}

export async function runWorkflowById(
  workflowId: number,
  initialItems: FlowItem[],
  mode: string,
  startNodeId?: string,
): Promise<RunResult> {
  const rows = await db.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1);
  if (!rows.length) throw new Error("Workflow پیدا نشد");
  const wf = rows[0];
  const nodes = asNodes(wf.nodes);
  const edges = asEdges(wf.edges);
  const start = startNodeId ? nodes.find((n) => n.id === startNodeId) : findManualStartNode(nodes, edges);
  if (!start) throw new Error("هیچ نود شروعی در Workflow پیدا نشد");
  return runWorkflowGraph(
    { id: wf.id, name: wf.name, nodes: wf.nodes, edges: wf.edges, errorWorkflowId: wf.errorWorkflowId },
    start.id,
    initialItems,
    mode,
  );
}
