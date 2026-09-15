/**
 * اعتبارسنج Workflow بر اساس Schema استاندارد n8n
 * -------------------------------------------------
 * 1) ساختار کلی را با zod بررسی می‌کند
 * 2) قوانین معنایی n8n را چک می‌کند (نود Trigger، اتصالات معتبر، نام یکتا، نوع مجاز)
 * 3) Workflow را نرمال می‌کند: تولید id/webhookId، اصلاح position، افزودن settings
 *
 * خروجی همیشه یک Workflow «قابل ارسال به POST /api/v1/workflows» است.
 */
import { randomUUID } from "crypto";
import { z } from "zod";
import { ALLOWED_NODE_CATALOG } from "./prompt";
import type { N8nWorkflow, ValidationResult } from "./types";

const connectionTargetSchema = z.object({
  node: z.string().min(1),
  type: z.string().min(1),
  index: z.number().int().nonnegative(),
});

const nodeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "نام نود خالی است"),
  type: z.string().min(1, "نوع نود خالی است"),
  typeVersion: z.number().positive(),
  position: z.tuple([z.number(), z.number()]).optional(),
  parameters: z.record(z.string(), z.unknown()).default({}),
  credentials: z
    .record(z.string(), z.object({ id: z.string().optional(), name: z.string() }))
    .optional(),
  webhookId: z.string().optional(),
  disabled: z.boolean().optional(),
  notes: z.string().optional(),
});

export const workflowSchema = z.object({
  name: z.string().min(1, "نام Workflow خالی است"),
  nodes: z.array(nodeSchema).min(1, "Workflow باید حداقل یک نود داشته باشد"),
  connections: z
    .record(z.string(), z.record(z.string(), z.array(z.array(connectionTargetSchema))))
    .default({}),
  settings: z.record(z.string(), z.unknown()).optional(),
  staticData: z.record(z.string(), z.unknown()).nullable().optional(),
});

/** انواع نودی که Trigger محسوب می‌شوند */
const TRIGGER_TYPES = new Set([
  "n8n-nodes-base.webhook",
  "n8n-nodes-base.scheduleTrigger",
  "n8n-nodes-base.manualTrigger",
  "n8n-nodes-base.formTrigger",
  "n8n-nodes-bale.baleTrigger",
  "@n8n/n8n-nodes-langchain.chatTrigger",
]);

/** نودهایی که به webhookId نیاز دارند */
const WEBHOOK_NODES = new Set(["n8n-nodes-base.webhook", "n8n-nodes-bale.baleTrigger"]);

const ALLOWED_TYPES = new Set<string>([
  ...ALLOWED_NODE_CATALOG.map((n) => n.type),
  "n8n-nodes-base.manualTrigger",
  "n8n-nodes-base.formTrigger",
  "n8n-nodes-base.noOp",
  "n8n-nodes-base.merge",
  "n8n-nodes-base.switch",
  "n8n-nodes-base.wait",
  "n8n-nodes-base.splitOut",
  "n8n-nodes-base.aggregate",
  "n8n-nodes-base.executeWorkflow",
  "@n8n/n8n-nodes-langchain.chatTrigger",
  "@n8n/n8n-nodes-langchain.memoryBufferWindow",
  "@n8n/n8n-nodes-langchain.lmChatOpenAi",
  "@n8n/n8n-nodes-langchain.toolHttpRequest",
  "@n8n/n8n-nodes-langchain.mcpClientTool",
]);

/**
 * تلاش برای استخراج JSON از متن خام مدل
 * (مدل‌ها گاهی JSON را داخل ```json ... ``` یا همراه توضیح می‌فرستند)
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* ادامه */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* ادامه */
    }
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }
  throw new Error("هیچ JSON معتبری در خروجی مدل یافت نشد");
}

/** اعتبارسنجی + نرمال‌سازی */
export function validateWorkflow(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // مرحلهٔ ۱: اعتبارسنجی ساختاری
  const parsed = workflowSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".") || "root"}: ${issue.message}`);
    }
    return {
      valid: false,
      errors,
      warnings,
      workflow: { name: "invalid", nodes: [], connections: {} },
    };
  }

  const wf = parsed.data;

  // مرحلهٔ ۲: قوانین معنایی
  const names = new Set<string>();
  let triggerCount = 0;
  wf.nodes.forEach((node, i) => {
    if (names.has(node.name)) errors.push(`نام نود تکراری است: "${node.name}"`);
    names.add(node.name);

    if (!ALLOWED_TYPES.has(node.type)) {
      errors.push(`نوع نود مجاز نیست: "${node.type}" (نود "${node.name}")`);
    }
    if (TRIGGER_TYPES.has(node.type)) triggerCount++;

    // نرمال‌سازی: id، webhookId، position
    if (!node.id) node.id = randomUUID();
    if (WEBHOOK_NODES.has(node.type) && !node.webhookId) node.webhookId = randomUUID();
    if (!node.position) {
      node.position = [i * 220, 0];
      warnings.push(`موقعیت نود "${node.name}" به‌صورت خودکار تنظیم شد`);
    }
  });

  if (triggerCount === 0) errors.push("Workflow هیچ نود Trigger ندارد");
  if (triggerCount > 1) warnings.push(`Workflow ${triggerCount} نود Trigger دارد`);

  // بررسی اتصالات: مبدا و مقصد باید وجود داشته باشند
  for (const [from, outputs] of Object.entries(wf.connections)) {
    if (!names.has(from)) errors.push(`اتصال از نود ناموجود: "${from}"`);
    for (const [connType, branches] of Object.entries(outputs)) {
      for (const branch of branches) {
        for (const target of branch) {
          if (!names.has(target.node)) {
            errors.push(`اتصال به نود ناموجود: "${target.node}" (از "${from}")`);
          }
          if (target.type !== connType) {
            // n8n خودش type را از کلید می‌خواند؛ فقط هماهنگ می‌کنیم
            target.type = connType;
          }
        }
      }
    }
  }

  // نودهای جدا افتاده (به‌جز Trigger و مدل‌های زبانی که با ai_* وصل می‌شوند)
  const connectedNodes = new Set<string>();
  for (const [from, outputs] of Object.entries(wf.connections)) {
    connectedNodes.add(from);
    for (const branches of Object.values(outputs)) {
      for (const branch of branches) for (const t of branch) connectedNodes.add(t.node);
    }
  }
  if (wf.nodes.length > 1) {
    for (const node of wf.nodes) {
      if (!connectedNodes.has(node.name)) {
        warnings.push(`نود "${node.name}" به هیچ نود دیگری متصل نیست`);
      }
    }
  }

  // AI Agent باید یک مدل زبانی متصل داشته باشد
  for (const node of wf.nodes) {
    if (
      node.type === "@n8n/n8n-nodes-langchain.agent" ||
      node.type === "@n8n/n8n-nodes-langchain.chainLlm"
    ) {
      const hasModel = Object.values(wf.connections).some((outputs) =>
        (outputs["ai_languageModel"] ?? []).some((branch) =>
          branch.some((t) => t.node === node.name),
        ),
      );
      if (!hasModel) errors.push(`نود "${node.name}" هیچ مدل زبانی (ai_languageModel) متصل ندارد`);
    }
  }

  // مرحلهٔ ۳: نرمال‌سازی نهایی
  const workflow: N8nWorkflow = {
    name: wf.name,
    nodes: wf.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      typeVersion: n.typeVersion,
      position: n.position as [number, number],
      parameters: n.parameters,
      ...(n.credentials ? { credentials: n.credentials } : {}),
      ...(n.webhookId ? { webhookId: n.webhookId } : {}),
      ...(n.disabled !== undefined ? { disabled: n.disabled } : {}),
      ...(n.notes ? { notes: n.notes } : {}),
    })),
    connections: wf.connections,
    settings: { executionOrder: "v1", ...(wf.settings ?? {}) },
  };

  return { valid: errors.length === 0, errors, warnings, workflow };
}
