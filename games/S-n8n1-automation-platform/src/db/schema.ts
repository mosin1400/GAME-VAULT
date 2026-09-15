// ==========================================================================
// Schema پایگاه‌داده پلتفرم اتوماسیون (Workflow Automation Platform Schema)
// همه‌ی جدول‌ها با Drizzle ORM / PostgreSQL تعریف شده‌اند.
// ==========================================================================
import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  jsonb,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

// --------------------------------------------------------------------------
// Workflows: هر Workflow شامل گراف کامل نودها و اتصالات (nodes/edges) است
// --------------------------------------------------------------------------
export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().default("Untitled Workflow"),
  description: text("description").default(""),
  // آرایه‌ی نودهای گراف (شامل type، position، parameters هر نود)
  nodes: jsonb("nodes").notNull().default([]),
  // آرایه‌ی یال‌ها / اتصالات بین نودها
  edges: jsonb("edges").notNull().default([]),
  // آیا Workflow فعال است (تریگرها/زمان‌بندی‌ها گوش می‌دهند)
  active: boolean("active").notNull().default(false),
  // Workflow خطا: در صورت شکست اجرای این Workflow، این یکی اجرا می‌شود
  errorWorkflowId: integer("error_workflow_id"),
  // محیط: dev/staging/prod
  environment: varchar("environment", { length: 32 }).notNull().default("dev"),
  tags: jsonb("tags").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --------------------------------------------------------------------------
// Executions: تاریخچه‌ی اجراهای هر Workflow
// --------------------------------------------------------------------------
export const executions = pgTable(
  "executions",
  {
    id: serial("id").primaryKey(),
    workflowId: integer("workflow_id").notNull(),
    workflowName: varchar("workflow_name", { length: 255 }).notNull().default(""),
    status: varchar("status", { length: 32 }).notNull().default("running"), // running | success | error | waiting
    mode: varchar("mode", { length: 32 }).notNull().default("manual"), // manual | webhook | schedule | trigger | error | sub-workflow
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    error: jsonb("error"),
    resultData: jsonb("result_data"),
  },
  (table) => [index("executions_workflow_idx").on(table.workflowId)],
);

// --------------------------------------------------------------------------
// Execution Logs: لاگ گام‌به‌گام هر نود در یک اجرا
// --------------------------------------------------------------------------
export const executionLogs = pgTable(
  "execution_logs",
  {
    id: serial("id").primaryKey(),
    executionId: integer("execution_id").notNull(),
    nodeId: varchar("node_id", { length: 128 }).notNull(),
    nodeName: varchar("node_name", { length: 255 }).notNull().default(""),
    nodeType: varchar("node_type", { length: 128 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("success"), // success | error | skipped
    input: jsonb("input"),
    output: jsonb("output"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
  },
  (table) => [index("execution_logs_execution_idx").on(table.executionId)],
);

// --------------------------------------------------------------------------
// Credentials: نگهداری رمزنگاری‌شده‌ی کلیدهای API / توکن‌ها
// --------------------------------------------------------------------------
export const credentials = pgTable("credentials", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 128 }).notNull(), // مثلا: slackApi, telegramApi, baleApi, smtp, ...
  // داده‌ی رمزنگاری‌شده (AES-256-GCM) به صورت رشته‌ی JSON base64
  encryptedData: text("encrypted_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --------------------------------------------------------------------------
// Global Variables: متغیرهای سراسری قابل استفاده در همه‌ی Workflowها
// --------------------------------------------------------------------------
export const variables = pgTable("variables", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --------------------------------------------------------------------------
// Audit Log: ثبت اقدامات مهم برای انطباق سازمانی (Compliance)
// --------------------------------------------------------------------------
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 128 }).notNull(),
  entity: varchar("entity", { length: 128 }).notNull(),
  entityId: varchar("entity_id", { length: 128 }).default(""),
  meta: jsonb("meta").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --------------------------------------------------------------------------
// Webhook registration cache (اختیاری، برای جست‌وجوی سریع مسیر وب‌هوک)
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// Vector Store ساده برای RAG (Retrieval-Augmented Generation)
// امبدینگ‌ها به صورت آرایه‌ی عددی در jsonb ذخیره می‌شوند و شباهت با Cosine
// Similarity در لایه‌ی اپلیکیشن محاسبه می‌شود (بدون نیاز به افزونه‌ی pgvector)
// --------------------------------------------------------------------------
export const vectorDocuments = pgTable("vector_documents", {
  id: serial("id").primaryKey(),
  namespace: varchar("namespace", { length: 128 }).notNull().default("default"),
  content: text("content").notNull(),
  metadata: jsonb("metadata").default({}),
  embedding: jsonb("embedding").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookRoutes = pgTable("webhook_routes", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull(),
  nodeId: varchar("node_id", { length: 128 }).notNull(),
  path: varchar("path", { length: 255 }).notNull(),
  method: varchar("method", { length: 16 }).notNull().default("POST"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
