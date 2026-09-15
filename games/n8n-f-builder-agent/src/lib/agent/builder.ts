/**
 * ارکستراتور Agent — چهار لایه در یک خط لوله
 * ============================================
 *  لایهٔ ۱ (Input)    : دریافت پیام از وب / بله / سروش / n8n  → ثبت درخواست
 *  لایهٔ ۲ (Core)     : Codex + دستورالعمل + دانش قبلی        → JSON Workflow
 *  لایهٔ ۳ (Builder)  : اعتبارسنجی + POST /api/v1/workflows    → id و لینک
 *  لایهٔ ۴ (Executor) : activate + مانیتور + Self-Heal          → گزارش به کاربر
 */
import { db } from "@/db";
import {
  agentLogs,
  automationRequests,
  executionEvents,
  generatedWorkflows,
  type AgentLayer,
  type LogLevel,
  type RequestStatus,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { trySendMessage } from "./bale";
import { generateWorkflow } from "./codex";
import { rememberLesson, rememberSuccess, retrieveKnowledge } from "./knowledge";
import {
  activateWorkflow,
  createWorkflow,
  isN8nConfigured,
  listExecutions,
  updateWorkflow,
  workflowEditorUrl,
} from "./n8n";
import { buildUserPrompt } from "./prompt";
import { buildFromTemplate } from "./templates";
import { validateWorkflow } from "./validator";
import type { InboundMessage, N8nWorkflow } from "./types";

/** حداکثر تلاش‌های خودترمیمی برای یک درخواست */
const MAX_HEAL_ATTEMPTS = Number(process.env.MAX_HEAL_ATTEMPTS ?? 3);
/** حداکثر تلاش برای رسیدن به JSON معتبر در لایهٔ ۲ */
const MAX_GENERATION_RETRIES = 2;

/* ------------------------------------------------------------------ */
/* ابزارهای کمکی                                                       */
/* ------------------------------------------------------------------ */

async function log(requestId: number, layer: AgentLayer, message: string, data?: unknown, level: LogLevel = "info") {
  await db.insert(agentLogs).values({ requestId, layer, level, message, data: data ?? null });
}

async function setStatus(requestId: number, status: RequestStatus, extra: Partial<typeof automationRequests.$inferInsert> = {}) {
  await db
    .update(automationRequests)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(automationRequests.id, requestId));
}

/** ارسال اعلان به کاربر در کانال مبدأ (اگر چت داشته باشد) */
async function notifyUser(requestId: number, text: string) {
  const [req] = await db.select().from(automationRequests).where(eq(automationRequests.id, requestId));
  if (!req?.chatId) return;
  if (req.source === "bale") await trySendMessage(req.chatId, text, "bale");
  if (req.source === "soroush") await trySendMessage(req.chatId, text, "soroush");
}

/* ------------------------------------------------------------------ */
/* لایهٔ ۱: ورودی                                                       */
/* ------------------------------------------------------------------ */

/** ثبت درخواست جدید و بازگرداندن شناسه */
export async function createRequest(msg: InboundMessage): Promise<number> {
  const [row] = await db
    .insert(automationRequests)
    .values({
      source: msg.source,
      chatId: msg.chatId ?? null,
      userName: msg.userName ?? null,
      prompt: msg.text.trim(),
      status: "received",
    })
    .returning({ id: automationRequests.id });
  await log(row.id, "input", `درخواست از کانال «${msg.source}» دریافت شد`, {
    chatId: msg.chatId,
    userName: msg.userName,
  });
  return row.id;
}

/* ------------------------------------------------------------------ */
/* لایهٔ ۲: مغز Agent                                                   */
/* ------------------------------------------------------------------ */

interface CoreOutput {
  workflow: N8nWorkflow;
  provider: string;
  warnings: string[];
}

/**
 * تولید + اعتبارسنجی با حلقهٔ تصحیح:
 * اگر JSON معتبر نبود، خطاها به مدل برگردانده می‌شود تا نسخهٔ اصلاح‌شده بدهد.
 */
async function runCore(requestId: number, prompt: string, previousError?: string): Promise<CoreOutput> {
  await setStatus(requestId, "planning");
  const knowledge = await retrieveKnowledge(prompt);
  await log(requestId, "core", `${knowledge.length} مورد دانش مرتبط از حافظه بازیابی شد`, {
    kinds: knowledge.map((k) => k.kind),
  });

  let feedback = previousError;
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt <= MAX_GENERATION_RETRIES; attempt++) {
    await setStatus(requestId, "generating");
    const userPrompt = buildUserPrompt(prompt, knowledge, feedback);
    await log(requestId, "core", `تولید Workflow (تلاش ${attempt + 1})`, { promptChars: userPrompt.length });

    const gen = await generateWorkflow(prompt, prompt, (m, d) => log(requestId, "core", m, d));

    await setStatus(requestId, "validating");
    const validation = validateWorkflow(gen.workflow);
    await log(
      requestId,
      "builder",
      validation.valid ? "اعتبارسنجی Schema موفق بود" : "اعتبارسنجی Schema ناموفق بود",
      { errors: validation.errors, warnings: validation.warnings },
      validation.valid ? "success" : "warn",
    );

    if (validation.valid) {
      if (gen.explanation) await log(requestId, "core", gen.explanation);
      return { workflow: validation.workflow, provider: gen.provider, warnings: validation.warnings };
    }

    lastErrors = validation.errors;
    feedback = `خطاهای اعتبارسنجی:\n${validation.errors.join("\n")}`;
    // اگر خودِ موتور قالب‌محور خطا داد، تکرار فایده ندارد
    if (gen.provider === "heuristic") break;
  }

  // شبکهٔ ایمنی نهایی: قالب داخلی
  await log(requestId, "core", "مدل نتوانست JSON معتبر بدهد؛ استفاده از قالب داخلی", { lastErrors }, "warn");
  const fallback = validateWorkflow(buildFromTemplate(prompt).workflow);
  if (!fallback.valid) throw new Error(`حتی قالب داخلی معتبر نیست: ${fallback.errors.join("; ")}`);
  return { workflow: fallback.workflow, provider: "heuristic", warnings: fallback.warnings };
}

/* ------------------------------------------------------------------ */
/* لایهٔ ۳: سازندهٔ Workflow                                           */
/* ------------------------------------------------------------------ */

interface BuildOutput {
  n8nWorkflowId: string | null;
  url: string | null;
  simulated: boolean;
}

async function runBuilder(requestId: number, workflow: N8nWorkflow, existingId?: string | null): Promise<BuildOutput> {
  await setStatus(requestId, "creating");

  if (!isN8nConfigured()) {
    await log(requestId, "builder", "n8n پیکربندی نشده؛ Workflow فقط ذخیره شد (حالت شبیه‌سازی)", undefined, "warn");
    return { n8nWorkflowId: null, url: null, simulated: true };
  }

  if (existingId) {
    // Self-Heal: نسخهٔ اصلاح‌شده جایگزین می‌شود
    await updateWorkflow(existingId, workflow);
    await log(requestId, "builder", `Workflow ${existingId} در n8n به‌روزرسانی شد (PUT)`, undefined, "success");
    return { n8nWorkflowId: existingId, url: workflowEditorUrl(existingId), simulated: false };
  }

  const { id } = await createWorkflow(workflow);
  const url = workflowEditorUrl(id);
  await log(requestId, "builder", `Workflow در n8n ساخته شد (POST /api/v1/workflows)`, { id, url }, "success");
  return { n8nWorkflowId: id, url, simulated: false };
}

/* ------------------------------------------------------------------ */
/* لایهٔ ۴: اجراکننده و مانیتور                                        */
/* ------------------------------------------------------------------ */

async function runExecutor(requestId: number, n8nWorkflowId: string | null): Promise<void> {
  if (!n8nWorkflowId) return;
  await setStatus(requestId, "activating");
  await activateWorkflow(n8nWorkflowId);
  await log(requestId, "executor", `Workflow ${n8nWorkflowId} فعال شد (POST /activate)`, undefined, "success");
}

/**
 * مانیتور: اجراهای اخیر Workflow را از n8n می‌گیرد، خطاها را ثبت می‌کند
 * و در صورت وجود خطای جدید، Self-Heal را آغاز می‌کند.
 */
export async function monitorRequest(requestId: number): Promise<{ newErrors: number; healed: boolean }> {
  const [req] = await db.select().from(automationRequests).where(eq(automationRequests.id, requestId));
  if (!req?.n8nWorkflowId || !isN8nConfigured()) return { newErrors: 0, healed: false };

  await setStatus(requestId, "monitoring");
  const executions = await listExecutions(req.n8nWorkflowId, 20);
  let newErrors = 0;
  let firstError: string | null = null;

  for (const ex of executions) {
    const [exists] = await db
      .select({ id: executionEvents.id })
      .from(executionEvents)
      .where(and(eq(executionEvents.n8nExecutionId, String(ex.id)), eq(executionEvents.n8nWorkflowId, req.n8nWorkflowId)));
    if (exists) continue;

    const errObj = ex.data?.resultData?.error;
    const errorMessage =
      ex.status === "error" || ex.status === "crashed"
        ? `${errObj?.message ?? "خطای نامشخص"}${errObj?.node?.name ? ` (نود: ${errObj.node.name})` : ""}`
        : null;

    await db.insert(executionEvents).values({
      requestId,
      n8nWorkflowId: req.n8nWorkflowId,
      n8nExecutionId: String(ex.id),
      status: ex.status,
      errorMessage,
    });
    if (errorMessage) {
      newErrors++;
      firstError ??= errorMessage;
    }
  }

  await log(requestId, "executor", `مانیتور: ${executions.length} اجرا بررسی شد، ${newErrors} خطای جدید`, undefined, newErrors ? "warn" : "info");
  await setStatus(requestId, "done");

  if (firstError && req.healAttempts < MAX_HEAL_ATTEMPTS) {
    await selfHeal(requestId, firstError);
    return { newErrors, healed: true };
  }
  return { newErrors, healed: false };
}

/* ------------------------------------------------------------------ */
/* Self-Heal                                                           */
/* ------------------------------------------------------------------ */

/** بازتولید Workflow با در نظر گرفتن خطا و جایگزینی نسخهٔ قبلی */
export async function selfHeal(requestId: number, errorMessage: string): Promise<void> {
  const [req] = await db.select().from(automationRequests).where(eq(automationRequests.id, requestId));
  if (!req) throw new Error("درخواست یافت نشد");
  if (req.healAttempts >= MAX_HEAL_ATTEMPTS) {
    await log(requestId, "executor", "سقف تلاش‌های Self-Heal پر شده است", undefined, "error");
    return;
  }

  await setStatus(requestId, "healing", { healAttempts: req.healAttempts + 1 });
  await log(requestId, "executor", `آغاز Self-Heal (تلاش ${req.healAttempts + 1}/${MAX_HEAL_ATTEMPTS})`, { errorMessage }, "warn");
  await notifyUser(requestId, `⚠️ خطایی در اتوماسیون شما دیده شد؛ در حال ترمیم خودکار...\n${errorMessage.slice(0, 300)}`);

  try {
    const core = await runCore(requestId, req.prompt, errorMessage);
    const [last] = await db
      .select({ version: generatedWorkflows.version })
      .from(generatedWorkflows)
      .where(eq(generatedWorkflows.requestId, requestId))
      .orderBy(desc(generatedWorkflows.version))
      .limit(1);

    const built = await runBuilder(requestId, core.workflow, req.n8nWorkflowId);
    await db.insert(generatedWorkflows).values({
      requestId,
      version: (last?.version ?? 0) + 1,
      name: core.workflow.name,
      workflowJson: core.workflow,
      valid: true,
      validationErrors: [],
      provider: core.provider,
      n8nWorkflowId: built.n8nWorkflowId,
      active: !built.simulated,
    });
    await runExecutor(requestId, built.n8nWorkflowId);

    // درس آموخته‌شده را به حافظه اضافه می‌کنیم
    await rememberLesson(req.prompt, errorMessage, `Workflow با ارائه‌دهندهٔ ${core.provider} بازتولید و جایگزین شد`);
    await db.update(executionEvents).set({ healed: true }).where(eq(executionEvents.requestId, requestId));

    await setStatus(requestId, "done", { resultSummary: `ترمیم خودکار انجام شد (نسخهٔ ${(last?.version ?? 0) + 1})` });
    await log(requestId, "executor", "Self-Heal با موفقیت انجام شد", undefined, "success");
    await notifyUser(requestId, `✅ اتوماسیون ترمیم و دوباره فعال شد.${built.url ? `\n${built.url}` : ""}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(requestId, "failed", { resultSummary: `Self-Heal ناموفق: ${message}` });
    await log(requestId, "executor", `Self-Heal ناموفق: ${message}`, undefined, "error");
    await notifyUser(requestId, `❌ ترمیم خودکار ناموفق بود: ${message.slice(0, 300)}`);
  }
}

/* ------------------------------------------------------------------ */
/* خط لولهٔ کامل                                                        */
/* ------------------------------------------------------------------ */

/** اجرای کامل: از درخواست ثبت‌شده تا Workflow فعال و گزارش به کاربر */
export async function processRequest(requestId: number): Promise<void> {
  const [req] = await db.select().from(automationRequests).where(eq(automationRequests.id, requestId));
  if (!req) throw new Error("درخواست یافت نشد");

  try {
    // لایهٔ ۲
    const core = await runCore(requestId, req.prompt);

    // لایهٔ ۳
    const built = await runBuilder(requestId, core.workflow);
    await db.insert(generatedWorkflows).values({
      requestId,
      version: 1,
      name: core.workflow.name,
      workflowJson: core.workflow,
      valid: true,
      validationErrors: core.warnings,
      provider: core.provider,
      n8nWorkflowId: built.n8nWorkflowId,
      active: false,
    });

    // لایهٔ ۴
    await runExecutor(requestId, built.n8nWorkflowId);
    if (built.n8nWorkflowId) {
      await db
        .update(generatedWorkflows)
        .set({ active: true })
        .where(and(eq(generatedWorkflows.requestId, requestId), eq(generatedWorkflows.version, 1)));
    }

    // حافظهٔ خودتکامل‌شونده
    await rememberSuccess(req.prompt, core.workflow);

    const summary = built.simulated
      ? `Workflow «${core.workflow.name}» ساخته و اعتبارسنجی شد (n8n متصل نیست — JSON آماده‌ی import است)`
      : `Workflow «${core.workflow.name}» ساخته و فعال شد`;

    await setStatus(requestId, "done", {
      resultSummary: summary,
      n8nWorkflowId: built.n8nWorkflowId,
      n8nWorkflowUrl: built.url,
      simulated: built.simulated,
    });
    await log(requestId, "executor", summary, undefined, "success");

    await notifyUser(
      requestId,
      `✅ ${summary}\n` +
        `نودها: ${core.workflow.nodes.map((n) => n.name).join(" → ")}\n` +
        (built.url ? `🔗 ${built.url}` : "") +
        `\nشناسهٔ درخواست: #${requestId}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(requestId, "failed", { resultSummary: message });
    await log(requestId, "executor", `خطا: ${message}`, undefined, "error");
    await notifyUser(requestId, `❌ ساخت اتوماسیون ناموفق بود:\n${message.slice(0, 400)}`);
  }
}

/** میان‌بر: ثبت + پردازش */
export async function handleInbound(msg: InboundMessage): Promise<number> {
  const id = await createRequest(msg);
  await processRequest(id);
  return id;
}
