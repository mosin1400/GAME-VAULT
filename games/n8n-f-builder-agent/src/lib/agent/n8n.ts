/**
 * کلاینت n8n — لایهٔ سوم و چهارم
 * --------------------------------
 * دو مسیر ارتباطی با هستهٔ n8n:
 *
 *  A) REST API رسمی (N8N_BASE_URL + N8N_API_KEY)
 *     - POST /api/v1/workflows                 → ایجاد
 *     - POST /api/v1/workflows/{id}/activate   → فعال‌سازی
 *     - GET  /api/v1/executions?workflowId=..  → مانیتور
 *     - PUT  /api/v1/workflows/{id}            → به‌روزرسانی (Self-Heal)
 *
 *  B) MCP Server داخلی n8n (N8N_MCP_URL + N8N_MCP_TOKEN)
 *     - endpoint: {base}/mcp-server/http  (JSON-RPC 2.0 / Streamable HTTP)
 *     - ابزارها: search_workflows, get_workflow_details, execute_workflow
 *     برای بررسی سلامت و اجرای آزمایشی Workflow استفاده می‌شود.
 *
 * اگر هیچ‌کدام پیکربندی نشده باشد، سیستم در حالت «شبیه‌سازی» کار می‌کند
 * (Workflow ساخته و ذخیره می‌شود اما به n8n ارسال نمی‌شود).
 */
import type { N8nWorkflow } from "./types";

export interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  status: "success" | "error" | "running" | "waiting" | "canceled" | "crashed" | string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  data?: {
    resultData?: {
      error?: { message?: string; description?: string; node?: { name?: string } };
      lastNodeExecuted?: string;
    };
  };
}

/** آیا n8n پیکربندی شده است؟ */
export function isN8nConfigured(): boolean {
  return Boolean(process.env.N8N_BASE_URL && process.env.N8N_API_KEY);
}

export function isMcpConfigured(): boolean {
  return Boolean(process.env.N8N_MCP_TOKEN);
}

function baseUrl(): string {
  return (process.env.N8N_BASE_URL ?? "http://localhost:5678").replace(/\/$/, "");
}

/** لینک عمومی ویرایشگر Workflow (برای نمایش به کاربر) */
export function workflowEditorUrl(id: string): string {
  const pub = (process.env.N8N_PUBLIC_URL ?? process.env.N8N_BASE_URL ?? "http://localhost:5678").replace(/\/$/, "");
  return `${pub}/workflow/${id}`;
}

/** درخواست عمومی به REST API با هدر X-N8N-API-KEY */
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl()}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-N8N-API-KEY": process.env.N8N_API_KEY ?? "",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`n8n API ${init.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/** بررسی اتصال به n8n (برای داشبورد) */
export async function pingN8n(): Promise<{ ok: boolean; message: string }> {
  if (!isN8nConfigured()) return { ok: false, message: "N8N_BASE_URL / N8N_API_KEY تنظیم نشده (حالت شبیه‌سازی)" };
  try {
    await api<{ data: unknown[] }>("/workflows?limit=1");
    return { ok: true, message: `متصل به ${baseUrl()}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** ایجاد Workflow — POST /api/v1/workflows */
export async function createWorkflow(workflow: N8nWorkflow): Promise<{ id: string }> {
  // n8n Public API فقط این فیلدها را می‌پذیرد
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings ?? { executionOrder: "v1" },
    staticData: workflow.staticData ?? null,
  };
  const created = await api<{ id: string }>("/workflows", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { id: String(created.id) };
}

/** به‌روزرسانی Workflow موجود — PUT /api/v1/workflows/{id} (برای Self-Heal) */
export async function updateWorkflow(id: string, workflow: N8nWorkflow): Promise<void> {
  await api(`/workflows/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings ?? { executionOrder: "v1" },
      staticData: workflow.staticData ?? null,
    }),
  });
}

/** فعال‌سازی — POST /api/v1/workflows/{id}/activate */
export async function activateWorkflow(id: string): Promise<void> {
  await api(`/workflows/${id}/activate`, { method: "POST" });
}

/** غیرفعال‌سازی — POST /api/v1/workflows/{id}/deactivate */
export async function deactivateWorkflow(id: string): Promise<void> {
  await api(`/workflows/${id}/deactivate`, { method: "POST" });
}

/** دریافت اجراهای اخیر یک Workflow — GET /api/v1/executions */
export async function listExecutions(workflowId: string, limit = 20): Promise<N8nExecution[]> {
  const res = await api<{ data: N8nExecution[] }>(
    `/executions?workflowId=${encodeURIComponent(workflowId)}&limit=${limit}&includeData=true`,
  );
  return res.data ?? [];
}

/* ------------------------------------------------------------------ */
/* MCP Server داخلی n8n                                                */
/* ------------------------------------------------------------------ */

interface McpResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

let mcpRequestId = 1;

/**
 * فراخوانی یک ابزار روی MCP Server داخلی n8n.
 * n8n از Streamable HTTP استفاده می‌کند؛ پاسخ ممکن است JSON یا text/event-stream باشد.
 */
export async function mcpCall<T = unknown>(
  method: "tools/list" | "tools/call",
  params: Record<string, unknown> = {},
): Promise<T> {
  const url = process.env.N8N_MCP_URL ?? `${baseUrl()}/mcp-server/http`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${process.env.N8N_MCP_TOKEN ?? ""}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: mcpRequestId++, method, params }),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MCP ${method} → ${res.status}: ${text.slice(0, 300)}`);

  // پاسخ SSE: خطوط "data: {...}" را استخراج می‌کنیم
  let parsed: McpResponse<T> | null = null;
  if (text.startsWith("event:") || text.includes("\ndata:")) {
    for (const line of text.split("\n")) {
      if (line.startsWith("data:")) {
        try {
          parsed = JSON.parse(line.slice(5).trim());
        } catch {
          /* ignore */
        }
      }
    }
  } else {
    parsed = JSON.parse(text);
  }
  if (!parsed) throw new Error("پاسخ MCP قابل تجزیه نبود");
  if (parsed.error) throw new Error(`MCP error ${parsed.error.code}: ${parsed.error.message}`);
  return parsed.result as T;
}

/** جزئیات Workflow از طریق MCP (get_workflow_details) */
export async function mcpGetWorkflowDetails(workflowId: string): Promise<unknown> {
  return mcpCall("tools/call", {
    name: "get_workflow_details",
    arguments: { workflowId },
  });
}

/** اجرای آزمایشی Workflow از طریق MCP (execute_workflow) */
export async function mcpExecuteWorkflow(workflowId: string, inputs: Record<string, unknown> = {}): Promise<unknown> {
  return mcpCall("tools/call", {
    name: "execute_workflow",
    arguments: { workflowId, inputs },
  });
}
