// ==========================================================================
// نود Sub-Workflow: فراخوانی یک Workflow دیگر از داخل Workflow جاری
// ==========================================================================
import type { NodeDefinition } from "../types";

export const executeWorkflowNode: NodeDefinition = {
  type: "executeWorkflow",
  name: "اجرای Sub-Workflow",
  group: "logic",
  category: "Logic",
  icon: "🧩",
  color: "#a855f7",
  description: "فراخوانی و اجرای یک Workflow دیگر با آیتم‌های جاری به عنوان ورودی",
  properties: [
    { name: "workflowId", label: "شناسه‌ی Workflow", type: "number", required: true },
  ],
  execute: async (ctx) => {
    const targetId = Number(ctx.parameters.workflowId);
    if (!targetId) throw new Error("شناسه‌ی Sub-Workflow مشخص نشده است");
    // Dynamic import برای جلوگیری از وابستگی چرخه‌ای بین registry و executor
    const { runWorkflowById } = await import("../executor");
    const result = await runWorkflowById(targetId, ctx.items, "sub-workflow");
    return result.items;
  },
};

export const subWorkflowNodes: NodeDefinition[] = [executeWorkflowNode];
