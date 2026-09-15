/**
 * اسکیمای پایگاه دادهٔ Automation Builder Agent
 * ------------------------------------------------
 * - automation_requests : هر درخواست زبان طبیعی کاربر (از وب، بله، سروش یا n8n)
 * - generated_workflows : نسخه‌های Workflow تولیدشده توسط مغز Agent برای هر درخواست
 * - agent_logs          : لاگ گام‌به‌گام چهار لایهٔ سیستم (input / core / builder / executor)
 * - execution_events    : رویدادهای اجرای Workflow در n8n (برای مانیتور و Self-Heal)
 * - knowledge_base      : حافظهٔ خودتکامل‌شونده؛ الگوهای موفق و درس‌های خطا
 */
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** منبع درخواست */
export type RequestSource = "web" | "bale" | "soroush" | "n8n";

/** وضعیت چرخهٔ حیات یک درخواست */
export type RequestStatus =
  | "received"
  | "planning"
  | "generating"
  | "validating"
  | "creating"
  | "activating"
  | "monitoring"
  | "done"
  | "failed"
  | "healing";

export const automationRequests = pgTable("automation_requests", {
  id: serial("id").primaryKey(),
  /** web | bale | soroush | n8n */
  source: text("source").$type<RequestSource>().notNull().default("web"),
  /** شناسهٔ چت (برای پاسخ‌دادن به کاربر در بله/سروش) */
  chatId: text("chat_id"),
  userName: text("user_name"),
  /** متن درخواست به زبان طبیعی */
  prompt: text("prompt").notNull(),
  status: text("status").$type<RequestStatus>().notNull().default("received"),
  /** خلاصهٔ نتیجهٔ نهایی (برای نمایش به کاربر) */
  resultSummary: text("result_summary"),
  /** شناسه و لینک Workflow ساخته‌شده در n8n */
  n8nWorkflowId: text("n8n_workflow_id"),
  n8nWorkflowUrl: text("n8n_workflow_url"),
  /** تعداد تلاش‌های Self-Heal انجام‌شده */
  healAttempts: integer("heal_attempts").notNull().default(0),
  /** آیا Workflow واقعاً در n8n ساخته شد یا فقط شبیه‌سازی شد (n8n پیکربندی نشده) */
  simulated: boolean("simulated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const generatedWorkflows = pgTable("generated_workflows", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => automationRequests.id, { onDelete: "cascade" }),
  /** شمارهٔ نسخه (هر Self-Heal یک نسخهٔ جدید می‌سازد) */
  version: integer("version").notNull().default(1),
  name: text("name").notNull(),
  /** JSON کامل Workflow با ساختار استاندارد n8n */
  workflowJson: jsonb("workflow_json").notNull(),
  valid: boolean("valid").notNull().default(false),
  validationErrors: jsonb("validation_errors").$type<string[]>().default([]),
  /** کدام ارائه‌دهندهٔ مدل این نسخه را تولید کرده است */
  provider: text("provider").notNull().default("heuristic"),
  n8nWorkflowId: text("n8n_workflow_id"),
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AgentLayer = "input" | "core" | "builder" | "executor";
export type LogLevel = "info" | "warn" | "error" | "success";

export const agentLogs = pgTable("agent_logs", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => automationRequests.id, { onDelete: "cascade" }),
  layer: text("layer").$type<AgentLayer>().notNull(),
  level: text("level").$type<LogLevel>().notNull().default("info"),
  message: text("message").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const executionEvents = pgTable("execution_events", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").references(() => automationRequests.id, {
    onDelete: "cascade",
  }),
  n8nWorkflowId: text("n8n_workflow_id").notNull(),
  n8nExecutionId: text("n8n_execution_id").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  /** آیا برای این خطا Self-Heal انجام شده است؟ */
  healed: boolean("healed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KnowledgeKind = "success_pattern" | "error_fix";

/**
 * پایگاه دانش خودتکامل‌شونده:
 * هر Workflow موفق به‌عنوان نمونهٔ few-shot ذخیره می‌شود و هر خطای ترمیم‌شده
 * به یک «درس» تبدیل می‌شود که در درخواست‌های بعدی به مدل تزریق می‌گردد.
 */
export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  kind: text("kind").$type<KnowledgeKind>().notNull(),
  /** کلیدواژه‌های استخراج‌شده برای بازیابی مشابهت */
  keywords: text("keywords").array().notNull().default([]),
  prompt: text("prompt").notNull(),
  workflowJson: jsonb("workflow_json"),
  lesson: text("lesson"),
  /** چند بار این دانش با موفقیت استفاده شده (وزن‌دهی) */
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AutomationRequest = typeof automationRequests.$inferSelect;
export type GeneratedWorkflow = typeof generatedWorkflows.$inferSelect;
export type AgentLog = typeof agentLogs.$inferSelect;
export type ExecutionEvent = typeof executionEvents.$inferSelect;
export type KnowledgeEntry = typeof knowledgeBase.$inferSelect;
