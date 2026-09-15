// ==========================================================================
// انواع داده‌ی مشترک موتور Workflow (Types)
// ==========================================================================

/** یک آیتم داده که بین نودها جریان می‌یابد (مشابه مدل Item در n8n) */
export interface FlowItem {
  json: Record<string, unknown>;
  binary?: Record<string, { fileName?: string; mimeType?: string; data: string }>;
}

export interface WorkflowNodeData extends Record<string, unknown> {
  id: string;
  type: string; // نوع نود، معادل NodeDefinition.type
  name: string;
  parameters: Record<string, unknown>;
  credentialId?: number | null;
  disabled?: boolean;
  notes?: string;
}

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: "automationNode";
  position: WorkflowNodePosition;
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type PropertyType =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "options"
  | "json"
  | "credential"
  | "code";

export interface NodeProperty {
  name: string; // کلید در parameters
  label: string;
  type: PropertyType;
  default?: unknown;
  options?: { label: string; value: string }[];
  placeholder?: string;
  description?: string;
  required?: boolean;
  rows?: number; // برای textarea
}

export type NodeGroup =
  | "trigger"
  | "action"
  | "logic"
  | "data"
  | "ai"
  | "communication"
  | "database"
  | "devops"
  | "iot"
  | "productivity";

export interface ExecuteContext {
  items: FlowItem[];
  parameters: Record<string, unknown>;
  credential?: Record<string, unknown> | null;
  getVariable: (key: string) => Promise<string | undefined>;
  workflowId: number;
  executionId: number;
  nodeId: string;
  helpers: {
    resolveExpression: (template: unknown, item: FlowItem, index: number) => unknown;
  };
}

export interface NodeDefinition {
  type: string;
  name: string;
  group: NodeGroup;
  category: string;
  icon: string; // ایموجی به عنوان آیکون سبک
  color: string;
  description: string;
  isTrigger?: boolean;
  credentialType?: string;
  outputs?: string[]; // برچسب خروجی‌ها؛ پیش‌فرض یک خروجی "main"
  properties: NodeProperty[];
  execute?: (ctx: ExecuteContext) => Promise<FlowItem[] | Record<string, FlowItem[]>>;
}

export interface CatalogEntry {
  type: string;
  name: string;
  category: string;
  group: NodeGroup;
  description: string;
  executable: boolean;
}
