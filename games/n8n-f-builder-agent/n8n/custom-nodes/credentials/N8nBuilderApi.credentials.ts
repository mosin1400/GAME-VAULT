/**
 * اعتبارنامهٔ دسترسی ابزار سازندهٔ Workflow به هستهٔ n8n
 * -------------------------------------------------------
 * - REST API: Settings → n8n API → Create API key  (هدر X-N8N-API-KEY)
 * - MCP:      Settings → MCP Server → Access Token (هدر Authorization: Bearer)
 */
import type { ICredentialTestRequest, ICredentialType, INodeProperties } from "n8n-workflow";

export class N8nBuilderApi implements ICredentialType {
  name = "n8nBuilderApi";
  displayName = "n8n Builder API (REST + MCP)";
  documentationUrl = "https://docs.n8n.io/api/";

  properties: INodeProperties[] = [
    {
      displayName: "n8n Base URL",
      name: "baseUrl",
      type: "string",
      default: "http://localhost:5678",
      required: true,
      description: "آدرس داخلی n8n (داخل docker معمولاً http://localhost:5678)",
    },
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
    },
    {
      displayName: "MCP Access Token",
      name: "mcpToken",
      type: "string",
      typeOptions: { password: true },
      default: "",
      description: "اختیاری — برای بررسی/اجرای Workflow از طریق MCP Server داخلی n8n",
    },
  ];

  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "/api/v1/workflows?limit=1",
      headers: { "X-N8N-API-KEY": "={{$credentials.apiKey}}" },
    },
  };
}
