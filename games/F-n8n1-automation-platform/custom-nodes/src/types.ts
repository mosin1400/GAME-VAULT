// ============================================================================
// Shared node interfaces (n8n-compatible subset) – رابط مشترک نودهای سفارشی
// ============================================================================
export type Item = { json: Record<string, unknown>; binary?: Record<string, { data: string; mimeType: string; fileName?: string }> };

export type PropertyType = "string" | "number" | "boolean" | "options" | "json";
export interface NodeProperty {
  displayName: string;
  name: string;
  type: PropertyType;
  default?: unknown;
  description?: string;
  options?: { name: string; value: string }[];
  required?: boolean;
  typeOptions?: Record<string, unknown>;
}

export interface NodeDescription {
  displayName: string;
  name: string;
  group: ("trigger" | "transform" | "output" | "input")[];
  version: number;
  description: string;
  icon: string;
  defaults: { name: string; color?: string };
  inputs: string[];
  outputs: string[];
  credentials?: { name: string; required?: boolean }[];
  properties: NodeProperty[];
  polling?: boolean;
}

/** context اجرای نود (زیرمجموعه‌ای از IExecuteFunctions در n8n) */
export interface ExecuteContext {
  getInputData(): Item[];
  getNodeParameter(name: string, itemIndex: number, fallback?: unknown): unknown;
  getCredentials(name: string): Promise<Record<string, string>>;
  helpers: { request(url: string, init?: RequestInit): Promise<unknown> };
  logger: { info(m: string): void; warn(m: string): void; error(m: string): void };
}

/** context تریگر (زیرمجموعه ITriggerFunctions) */
export interface TriggerContext extends ExecuteContext {
  emit(items: Item[][]): void;
}

export interface INodeType {
  description: NodeDescription;
  execute?(this: ExecuteContext): Promise<Item[][]>;
  trigger?(this: TriggerContext): Promise<{ closeFunction?: () => Promise<void>; manualTriggerFunction?: () => Promise<void> }>;
}

export interface ICredentialType {
  name: string;
  displayName: string;
  properties: NodeProperty[];
}

/** کمک‌کننده: fetch با JSON */
export async function requestJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { statusCode: res.status, body: text }; }
}
