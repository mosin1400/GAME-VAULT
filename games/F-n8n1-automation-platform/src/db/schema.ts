// ============================================================================
// FlowForge – Database Schema (Drizzle ORM / PostgreSQL)
// اسکیمای دیتابیس پلتفرم اتوماسیون FlowForge
// ============================================================================
import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Workflows – تعریف جریان‌های کاری (نودها + اتصالات)
// ---------------------------------------------------------------------------
export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").default(""),
  active: boolean("active").default(false).notNull(),
  // نودها و اتصالات به‌صورت JSON ذخیره می‌شوند
  nodes: jsonb("nodes").$type<WorkflowNode[]>().default([]).notNull(),
  edges: jsonb("edges").$type<WorkflowEdge[]>().default([]).notNull(),
  settings: jsonb("settings").$type<WorkflowSettings>().default({}).notNull(),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  environment: varchar("environment", { length: 32 }).default("dev").notNull(),
  project: varchar("project", { length: 128 }).default("default").notNull(),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Workflow Versions – کنترل نسخه (هر ذخیره یک نسخه جدید)
// ---------------------------------------------------------------------------
export const workflowVersions = pgTable("workflow_versions", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull(),
  version: integer("version").notNull(),
  nodes: jsonb("nodes").$type<WorkflowNode[]>().default([]).notNull(),
  edges: jsonb("edges").$type<WorkflowEdge[]>().default([]).notNull(),
  message: text("message").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Executions – تاریخچه اجراها
// ---------------------------------------------------------------------------
export const executions = pgTable("executions", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull(),
  workflowName: varchar("workflow_name", { length: 255 }).default(""),
  status: varchar("status", { length: 32 }).default("running").notNull(), // running | success | error | waiting
  mode: varchar("mode", { length: 32 }).default("manual").notNull(), // manual | webhook | schedule | api | error
  triggerData: jsonb("trigger_data").default({}),
  // خروجی هر نود + لاگ‌ها
  result: jsonb("result").$type<ExecutionResult>().default({ nodes: {}, logs: [] }),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  durationMs: integer("duration_ms"),
});

// ---------------------------------------------------------------------------
// Credentials – اعتبارنامه‌ها (رمزنگاری‌شده در حالت ذخیره)
// ---------------------------------------------------------------------------
export const credentials = pgTable("credentials", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 128 }).notNull(), // apiKey | oauth2 | basic | telegram | bale | ...
  // داده رمزنگاری شده با AES-256-GCM
  data: text("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Variables – متغیرهای سراسری
// ---------------------------------------------------------------------------
export const variables = pgTable("variables", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Audit Log – ثبت تمام اقدامات
// ---------------------------------------------------------------------------
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actor: varchar("actor", { length: 128 }).default("admin").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  resource: varchar("resource", { length: 64 }).notNull(),
  resourceId: varchar("resource_id", { length: 64 }),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Users & Roles – کاربران و نقش‌ها (RBAC)
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 32 }).default("member").notNull(), // owner | admin | editor | member | viewer
  passwordHash: text("password_hash"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  userId: integer("user_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customNodes = pgTable("custom_nodes", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 80 }).notNull().unique(),
  specification: jsonb("specification").notNull(),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Types – تایپ‌های مشترک
// ---------------------------------------------------------------------------
export type WorkflowNode = {
  id: string;
  type: string; // شناسه نوع نود مثل "httpRequest"
  name: string;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
  credentialId?: number | null;
  disabled?: boolean;
  notes?: string;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null; // "true" | "false" | "main" | "loop" | "done"
  targetHandle?: string | null;
};

export type WorkflowSettings = {
  errorWorkflowId?: number | null;
  timeoutSeconds?: number;
  saveExecutions?: boolean;
  timezone?: string;
  concurrency?: number;
};

export type ExecutionLog = {
  ts: string;
  level: "info" | "warn" | "error" | "debug";
  nodeId?: string;
  message: string;
};

export type NodeRunResult = {
  status: "success" | "error" | "skipped";
  output: unknown[];
  error?: string;
  durationMs: number;
  startedAt: string;
};

export type ExecutionResult = {
  nodes: Record<string, NodeRunResult>;
  logs: ExecutionLog[];
};

export type Workflow = typeof workflows.$inferSelect;
export type Execution = typeof executions.$inferSelect;
export type Credential = typeof credentials.$inferSelect;
export type Variable = typeof variables.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
