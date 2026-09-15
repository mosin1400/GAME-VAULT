/**
 * نود Workflow Builder Tool
 * ==========================
 * ابزار لایهٔ سوم: JSON تولیدشده توسط Agent را می‌گیرد، اعتبارسنجی می‌کند،
 * از طریق REST API رسمی n8n (یا MCP Server داخلی) Workflow می‌سازد/به‌روزرسانی/فعال می‌کند
 * و شناسه + لینک را برمی‌گرداند.
 *
 * چون usableAsTool = true است، AI Agent می‌تواند مستقیماً آن را به‌عنوان Tool صدا بزند.
 *
 * عملیات:
 *  - create      : POST /api/v1/workflows  (+ activate اختیاری)
 *  - update      : PUT  /api/v1/workflows/{id}  (Self-Heal)
 *  - activate    : POST /api/v1/workflows/{id}/activate
 *  - deactivate  : POST /api/v1/workflows/{id}/deactivate
 *  - validate    : فقط اعتبارسنجی (بدون تماس با n8n)
 *  - executions  : GET  /api/v1/executions?workflowId=...  (مانیتور)
 *  - mcpCall     : فراخوانی ابزار روی MCP Server داخلی n8n (search_workflows / get_workflow_details / execute_workflow)
 */
import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestOptions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import { NodeOperationError, type NodeConnectionType } from "n8n-workflow";
import { extractJson, validateAndNormalize } from "./schema";

interface BuilderCreds {
  baseUrl: string;
  apiKey: string;
  mcpToken?: string;
}

export class WorkflowBuilder implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Workflow Builder Tool",
    name: "workflowBuilder",
    icon: "file:builder.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: "اعتبارسنجی، ایجاد، فعال‌سازی و مانیتور Workflow در n8n (REST API + MCP)",
    defaults: { name: "Workflow Builder" },
    inputs: ["main" as NodeConnectionType],
    outputs: ["main" as NodeConnectionType],
    usableAsTool: true,
    credentials: [{ name: "n8nBuilderApi", required: true }],
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "Validate + Create (+Activate)", value: "create", action: "Create workflow from JSON" },
          { name: "Update Existing (Self-Heal)", value: "update", action: "Replace workflow JSON" },
          { name: "Activate", value: "activate", action: "Activate workflow" },
          { name: "Deactivate", value: "deactivate", action: "Deactivate workflow" },
          { name: "Validate Only", value: "validate", action: "Validate JSON only" },
          { name: "List Executions (Monitor)", value: "executions", action: "List recent executions" },
          { name: "MCP Tool Call", value: "mcpCall", action: "Call n8n MCP server tool" },
        ],
        default: "create",
      },
      {
        displayName: "Workflow JSON",
        name: "workflowJson",
        type: "string",
        typeOptions: { rows: 12 },
        default: "={{ $json.output }}",
        required: true,
        displayOptions: { show: { operation: ["create", "update", "validate"] } },
        description: "JSON کامل Workflow (خروجی AI Agent). می‌تواند داخل ```json``` باشد.",
      },
      {
        displayName: "Activate After Create",
        name: "activate",
        type: "boolean",
        default: true,
        displayOptions: { show: { operation: ["create", "update"] } },
      },
      {
        displayName: "Workflow ID",
        name: "workflowId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { operation: ["update", "activate", "deactivate", "executions"] } },
      },
      {
        displayName: "Limit",
        name: "limit",
        type: "number",
        default: 20,
        displayOptions: { show: { operation: ["executions"] } },
      },
      {
        displayName: "MCP Tool Name",
        name: "mcpTool",
        type: "options",
        options: [
          { name: "search_workflows", value: "search_workflows" },
          { name: "get_workflow_details", value: "get_workflow_details" },
          { name: "execute_workflow", value: "execute_workflow" },
        ],
        default: "get_workflow_details",
        displayOptions: { show: { operation: ["mcpCall"] } },
      },
      {
        displayName: "MCP Arguments (JSON)",
        name: "mcpArgs",
        type: "json",
        default: '{ "workflowId": "" }',
        displayOptions: { show: { operation: ["mcpCall"] } },
      },
      {
        displayName: "Public Editor URL",
        name: "publicUrl",
        type: "string",
        default: "",
        description: "اختیاری — آدرس عمومی n8n برای ساخت لینک قابل کلیک (مثلاً https://n8n.example.com)",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const out: INodeExecutionData[] = [];
    const operation = this.getNodeParameter("operation", 0) as string;
    const creds = (await this.getCredentials("n8nBuilderApi")) as unknown as BuilderCreds;
    const baseUrl = creds.baseUrl.replace(/\/$/, "");

    /** تماس با REST API n8n */
    const api = async (path: string, method: IHttpRequestOptions["method"] = "GET", body?: IDataObject): Promise<IDataObject> => {
      const res = await this.helpers.httpRequest({
        method,
        url: `${baseUrl}/api/v1${path}`,
        headers: { "X-N8N-API-KEY": creds.apiKey, Accept: "application/json" },
        body,
        json: true,
      });
      return (res ?? {}) as IDataObject;
    };

    /** تماس با MCP Server داخلی n8n (JSON-RPC 2.0) */
    const mcp = async (name: string, args: IDataObject): Promise<IDataObject> => {
      if (!creds.mcpToken) throw new Error("MCP Access Token در اعتبارنامه تنظیم نشده است");
      const res = await this.helpers.httpRequest({
        method: "POST",
        url: `${baseUrl}/mcp-server/http`,
        headers: {
          Authorization: `Bearer ${creds.mcpToken}`,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        body: { jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } },
        json: false,
      });
      const text = String(res);
      let parsed: IDataObject | null = null;
      if (text.includes("data:")) {
        for (const line of text.split("\n")) if (line.startsWith("data:")) parsed = JSON.parse(line.slice(5).trim());
      } else parsed = JSON.parse(text);
      if (parsed?.error) throw new Error(`MCP error: ${JSON.stringify(parsed.error)}`);
      return (parsed?.result ?? {}) as IDataObject;
    };

    const editorUrl = (id: string) => {
      const pub = ((this.getNodeParameter("publicUrl", 0, "") as string) || baseUrl).replace(/\/$/, "");
      return `${pub}/workflow/${id}`;
    };

    for (let i = 0; i < items.length; i++) {
      try {
        let result: IDataObject = {};

        if (operation === "validate" || operation === "create" || operation === "update") {
          const raw = this.getNodeParameter("workflowJson", i) as string | IDataObject;
          const json = typeof raw === "string" ? extractJson(raw) : raw;
          const v = validateAndNormalize(json);

          if (operation === "validate") {
            result = { valid: v.valid, errors: v.errors, warnings: v.warnings, workflow: v.workflow as unknown as IDataObject };
          } else {
            if (!v.valid) {
              // خطاها را ساختاریافته برمی‌گردانیم تا Agent بتواند خودش را اصلاح کند
              throw new Error(`Workflow validation failed:\n- ${v.errors.join("\n- ")}`);
            }
            const payload: IDataObject = {
              name: v.workflow.name,
              nodes: v.workflow.nodes as unknown as IDataObject[],
              connections: v.workflow.connections as IDataObject,
              settings: v.workflow.settings as IDataObject,
              staticData: null,
            };
            let id: string;
            if (operation === "create") {
              const created = await api("/workflows", "POST", payload);
              id = String(created.id);
            } else {
              id = this.getNodeParameter("workflowId", i) as string;
              await api(`/workflows/${id}`, "PUT", payload);
            }
            let active = false;
            if (this.getNodeParameter("activate", i) as boolean) {
              await api(`/workflows/${id}/activate`, "POST");
              active = true;
            }
            result = {
              success: true,
              id,
              url: editorUrl(id),
              active,
              name: v.workflow.name,
              nodes: v.workflow.nodes.map((n) => n.name),
              warnings: v.warnings,
            };
          }
        } else if (operation === "activate" || operation === "deactivate") {
          const id = this.getNodeParameter("workflowId", i) as string;
          await api(`/workflows/${id}/${operation}`, "POST");
          result = { success: true, id, url: editorUrl(id), active: operation === "activate" };
        } else if (operation === "executions") {
          const id = this.getNodeParameter("workflowId", i) as string;
          const limit = this.getNodeParameter("limit", i) as number;
          const res = await api(`/executions?workflowId=${encodeURIComponent(id)}&limit=${limit}&includeData=true`);
          const data = (res.data as IDataObject[]) ?? [];
          const errors = data
            .filter((e) => e.status === "error" || e.status === "crashed")
            .map((e) => {
              const rd = ((e.data as IDataObject)?.resultData as IDataObject) ?? {};
              const err = (rd.error as IDataObject) ?? {};
              return { executionId: e.id, message: err.message, node: (err.node as IDataObject)?.name, startedAt: e.startedAt };
            });
          result = { workflowId: id, total: data.length, errorCount: errors.length, errors, executions: data };
        } else if (operation === "mcpCall") {
          const name = this.getNodeParameter("mcpTool", i) as string;
          const argsRaw = this.getNodeParameter("mcpArgs", i) as string | IDataObject;
          const args = typeof argsRaw === "string" ? (JSON.parse(argsRaw || "{}") as IDataObject) : argsRaw;
          result = await mcp(name, args);
        }

        out.push({ json: result, pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          out.push({ json: { success: false, error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
      }
    }
    return [out];
  }
}
