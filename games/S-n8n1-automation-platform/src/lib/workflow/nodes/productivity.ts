// ==========================================================================
// نودهای بهره‌وری/DevOps با اجرای واقعی از طریق REST API عمومی
// ==========================================================================
import type { NodeDefinition } from "../types";
import { buildScope, resolveExpressionDeep } from "../expression";

export const githubNode: NodeDefinition = {
  type: "github",
  name: "GitHub",
  group: "devops",
  category: "Development & DevOps",
  icon: "🐙",
  color: "#181717",
  description: "ایجاد Issue، کامنت یا واکشی اطلاعات مخزن با GitHub REST API",
  credentialType: "githubApi",
  properties: [
    { name: "operation", label: "عملیات", type: "options", default: "createIssue", options: [
      { label: "ایجاد Issue", value: "createIssue" },
      { label: "دریافت اطلاعات مخزن", value: "getRepo" },
    ] },
    { name: "owner", label: "Owner", type: "string", required: true },
    { name: "repo", label: "Repo", type: "string", required: true },
    { name: "title", label: "عنوان Issue", type: "string", default: "{{$json.title}}" },
    { name: "body", label: "متن Issue", type: "text", default: "{{$json.body}}" },
  ],
  execute: async (ctx) => {
    const cred = ctx.credential as { token?: string } | null;
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (cred?.token) headers.Authorization = `Bearer ${cred.token}`;
    const scope = buildScope(ctx.items[0] ?? { json: {} }, 0, ctx.items, {});
    const owner = ctx.parameters.owner;
    const repo = ctx.parameters.repo;
    if (ctx.parameters.operation === "getRepo") {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      return [{ json: await res.json() }];
    }
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: resolveExpressionDeep(ctx.parameters.title, scope),
        body: resolveExpressionDeep(ctx.parameters.body, scope),
      }),
    });
    return [{ json: await res.json() }];
  },
};

export const notionNode: NodeDefinition = {
  type: "notion",
  name: "Notion",
  group: "productivity",
  category: "Productivity",
  icon: "📝",
  color: "#000000",
  description: "ایجاد صفحه یا افزودن رکورد در Notion Database",
  credentialType: "notionApi",
  properties: [
    { name: "databaseId", label: "Database ID", type: "string", required: true },
    { name: "titlePropertyName", label: "نام فیلد عنوان", type: "string", default: "Name" },
    { name: "title", label: "عنوان", type: "string", default: "{{$json.title}}" },
  ],
  execute: async (ctx) => {
    const cred = ctx.credential as { apiKey?: string } | null;
    if (!cred?.apiKey) throw new Error("Credential Notion (apiKey) تنظیم نشده است");
    const scope = buildScope(ctx.items[0] ?? { json: {} }, 0, ctx.items, {});
    const title = String(resolveExpressionDeep(ctx.parameters.title, scope) ?? "");
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.apiKey}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: ctx.parameters.databaseId },
        properties: {
          [String(ctx.parameters.titlePropertyName || "Name")]: { title: [{ text: { content: title } }] },
        },
      }),
    });
    return [{ json: await res.json() }];
  },
};

export const googleSheetsAppendNode: NodeDefinition = {
  type: "googleSheetsAppend",
  name: "Google Sheets: افزودن ردیف",
  group: "productivity",
  category: "Google Workspace",
  icon: "📊",
  color: "#0f9d58",
  description: "افزودن یک ردیف جدید به Google Sheet با OAuth Access Token",
  credentialType: "googleApi",
  properties: [
    { name: "spreadsheetId", label: "Spreadsheet ID", type: "string", required: true },
    { name: "range", label: "محدوده (مثال: Sheet1!A:Z)", type: "string", default: "Sheet1!A:Z" },
    { name: "rowJson", label: "ردیف (آرایه‌ی JSON)", type: "json", default: '["{{$json.col1}}", "{{$json.col2}}"]' },
  ],
  execute: async (ctx) => {
    const cred = ctx.credential as { accessToken?: string } | null;
    if (!cred?.accessToken) throw new Error("Credential Google (accessToken) تنظیم نشده است");
    const scope = buildScope(ctx.items[0] ?? { json: {} }, 0, ctx.items, {});
    const rowTemplate = JSON.parse(String(ctx.parameters.rowJson || "[]"));
    const row = resolveExpressionDeep(rowTemplate, scope);
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ctx.parameters.spreadsheetId}/values/${encodeURIComponent(String(ctx.parameters.range))}:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${cred.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
      },
    );
    return [{ json: await res.json() }];
  },
};

export const productivityNodes: NodeDefinition[] = [githubNode, notionNode, googleSheetsAppendNode];
