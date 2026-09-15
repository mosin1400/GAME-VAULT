/**
 * تایپ‌های مشترک هستهٔ Agent
 * ---------------------------
 * ساختار Workflow در n8n (نسخهٔ ساده‌شده اما کاملاً سازگار با REST API رسمی).
 */

/** یک نود در Workflow n8n */
export interface N8nNode {
  /** شناسهٔ یکتا (UUID) */
  id?: string;
  /** نام نمایشی — در connections از همین نام استفاده می‌شود */
  name: string;
  /** نوع نود مانند n8n-nodes-base.webhook */
  type: string;
  typeVersion: number;
  /** مختصات روی بوم [x, y] */
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id?: string; name: string }>;
  /** برای Trigger های webhook */
  webhookId?: string;
  disabled?: boolean;
  notes?: string;
}

/** مقصد یک اتصال */
export interface N8nConnectionTarget {
  node: string;
  type: string; // main | ai_languageModel | ai_tool | ai_memory | ...
  index: number;
}

/** ساختار connections: { [نام نود مبدا]: { main: [[target, ...], ...] } } */
export type N8nConnections = Record<
  string,
  Record<string, N8nConnectionTarget[][]>
>;

/** ساختار کامل Workflow که به POST /api/v1/workflows ارسال می‌شود */
export interface N8nWorkflow {
  name: string;
  nodes: N8nNode[];
  connections: N8nConnections;
  settings?: Record<string, unknown>;
  staticData?: Record<string, unknown> | null;
  /** فقط در پاسخ n8n */
  id?: string;
  active?: boolean;
}

/** ارائه‌دهنده‌های مدل که مغز Agent می‌تواند از آن‌ها استفاده کند */
export type LlmProvider =
  | "codex-cli" // اجرای مستقیم دستور `codex exec` با اشتراک کاربر
  | "codex-n8n" // فراخوانی Workflow پروکسی در n8n که از نود Codex Chat Model استفاده می‌کند
  | "openai-compatible" // هر API سازگار با OpenAI
  | "heuristic"; // موتور قالب‌محور داخلی (بدون نیاز به شبکه)

/** خروجی تولید مدل */
export interface GenerationResult {
  provider: LlmProvider;
  workflow: N8nWorkflow;
  /** توضیح مدل دربارهٔ Workflow (اختیاری) */
  explanation?: string;
  rawText?: string;
}

/** نتیجهٔ اعتبارسنجی */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Workflow نرمال‌شده (با idهای تولیدشده، موقعیت‌های اصلاح‌شده و ...) */
  workflow: N8nWorkflow;
}

/** پیام ورودی نرمال‌شده از هر کانال */
export interface InboundMessage {
  source: "web" | "bale" | "soroush" | "n8n";
  chatId?: string;
  userName?: string;
  text: string;
}
