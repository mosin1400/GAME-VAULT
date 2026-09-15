/**
 * اعتبارسنج سبک Workflow (بدون وابستگی خارجی) برای نود WorkflowBuilder
 * -----------------------------------------------------------------------
 * همان قوانین اعتبارسنج اپ Agent را پیاده می‌کند تا JSON قبل از ارسال به
 * POST /api/v1/workflows بررسی و نرمال شود.
 */
import { randomUUID } from "crypto";

export interface WorkflowLike {
  name: string;
  nodes: Array<{
    id?: string;
    name: string;
    type: string;
    typeVersion: number;
    position?: [number, number];
    parameters?: Record<string, unknown>;
    credentials?: Record<string, { id?: string; name: string }>;
    webhookId?: string;
    [k: string]: unknown;
  }>;
  connections: Record<string, Record<string, Array<Array<{ node: string; type: string; index: number }>>>>;
  settings?: Record<string, unknown>;
  staticData?: Record<string, unknown> | null;
}

const TRIGGER_TYPES = new Set([
  "n8n-nodes-base.webhook",
  "n8n-nodes-base.scheduleTrigger",
  "n8n-nodes-base.manualTrigger",
  "n8n-nodes-base.formTrigger",
  "n8n-nodes-bale.baleTrigger",
  "@n8n/n8n-nodes-langchain.chatTrigger",
]);
const WEBHOOK_TYPES = new Set(["n8n-nodes-base.webhook", "n8n-nodes-bale.baleTrigger"]);

/** استخراج JSON از متن (پشتیبانی از ```json``` و متن اضافه) */
export function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    /* continue */
  }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return JSON.parse(fence[1].trim());
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a !== -1 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("No JSON object found in input");
}

export function validateAndNormalize(input: unknown): { valid: boolean; errors: string[]; warnings: string[]; workflow: WorkflowLike } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const wf = input as WorkflowLike;

  if (!wf || typeof wf !== "object") errors.push("root: workflow must be an object");
  if (!wf?.name || typeof wf.name !== "string") errors.push("name: required string");
  if (!Array.isArray(wf?.nodes) || wf.nodes.length === 0) errors.push("nodes: non-empty array required");
  if (wf && (wf.connections === undefined || typeof wf.connections !== "object")) wf.connections = {};

  if (errors.length) return { valid: false, errors, warnings, workflow: wf };

  const names = new Set<string>();
  let triggers = 0;
  wf.nodes.forEach((n, i) => {
    if (!n.name) errors.push(`nodes[${i}].name: required`);
    if (!n.type) errors.push(`nodes[${i}].type: required`);
    if (typeof n.typeVersion !== "number") errors.push(`nodes[${i}].typeVersion: number required`);
    if (names.has(n.name)) errors.push(`duplicate node name "${n.name}"`);
    names.add(n.name);
    if (TRIGGER_TYPES.has(n.type)) triggers++;
    if (!n.id) n.id = randomUUID();
    if (WEBHOOK_TYPES.has(n.type) && !n.webhookId) n.webhookId = randomUUID();
    if (!n.position) {
      n.position = [i * 220, 0];
      warnings.push(`position auto-assigned for "${n.name}"`);
    }
    if (!n.parameters) n.parameters = {};
  });
  if (triggers === 0) errors.push("workflow has no trigger node");

  for (const [from, outputs] of Object.entries(wf.connections)) {
    if (!names.has(from)) errors.push(`connection from unknown node "${from}"`);
    for (const [type, branches] of Object.entries(outputs)) {
      for (const branch of branches) {
        for (const target of branch) {
          if (!names.has(target.node)) errors.push(`connection to unknown node "${target.node}"`);
          target.type = type;
        }
      }
    }
  }

  // AI Agent / Chain باید مدل زبانی داشته باشد
  for (const n of wf.nodes) {
    if (n.type === "@n8n/n8n-nodes-langchain.agent" || n.type === "@n8n/n8n-nodes-langchain.chainLlm") {
      const has = Object.values(wf.connections).some((o) => (o.ai_languageModel ?? []).some((b) => b.some((t) => t.node === n.name)));
      if (!has) errors.push(`"${n.name}" has no ai_languageModel connected`);
    }
  }

  wf.settings = { executionOrder: "v1", ...(wf.settings ?? {}) };
  return { valid: errors.length === 0, errors, warnings, workflow: wf };
}
