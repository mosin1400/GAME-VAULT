// ============================================================================
// Codex Agent Node – استفاده از Codex به‌عنوان Chat Model از طریق اشتراک موجود
// احراز هویت: device-code (توکن از ~/.codex/auth.json) – بدون API Key پولی
// در صورت انقضا، با refresh_token توکن تازه می‌شود.
// ============================================================================
import type { INodeType, ExecuteContext, Item } from "../types";

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://auth.openai.com/oauth/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: "app_EMoamEEZ73f0CkXaXp7hrann" }),
    });
    if (!res.ok) return null;
    return (await res.json()).access_token ?? null;
  } catch { return null; }
}

export class CodexAgent implements INodeType {
  description = {
    displayName: "Codex Agent",
    name: "codexAgent",
    group: ["transform" as const],
    version: 1,
    description: "Chat/Agent با Codex (اشتراک ChatGPT، device-code auth)",
    icon: "fa:code",
    defaults: { name: "Codex Agent", color: "#111827" },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [{ name: "codexAuth", required: true }],
    properties: [
      { displayName: "Model", name: "model", type: "string" as const, default: "codex-mini-latest" },
      { displayName: "Instructions (System)", name: "instructions", type: "string" as const, default: "You are Codex, an expert software engineer." },
      { displayName: "Prompt", name: "prompt", type: "string" as const, default: "={{ $json.task }}" },
      { displayName: "Reasoning Effort", name: "reasoning", type: "options" as const, default: "medium", options: [{ name: "Low", value: "low" }, { name: "Medium", value: "medium" }, { name: "High", value: "high" }] },
    ],
  };

  async execute(this: ExecuteContext): Promise<Item[][]> {
    const items = this.getInputData();
    const cred = await this.getCredentials("codexAuth");
    let token = cred.accessToken;
    const base = (cred.baseUrl || "https://chatgpt.com/backend-api/codex").replace(/\/$/, "");
    const out: Item[] = [];
    const call = async (body: unknown) => fetch(`${base}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(cred.accountId ? { "ChatGPT-Account-Id": cred.accountId } : {}), "OpenAI-Beta": "responses=experimental", originator: "flowforge" },
      body: JSON.stringify(body),
    });
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const body = {
        model: this.getNodeParameter("model", i, "codex-mini-latest"),
        instructions: this.getNodeParameter("instructions", i, ""),
        input: [{ role: "user", content: [{ type: "input_text", text: String(this.getNodeParameter("prompt", i, "")) }] }],
        reasoning: { effort: this.getNodeParameter("reasoning", i, "medium") },
        store: false, stream: false,
      };
      let res = await call(body);
      if (res.status === 401 && cred.refreshToken) {
        const fresh = await refreshAccessToken(cred.refreshToken);
        if (fresh) { token = fresh; res = await call(body); }
      }
      const data = await res.json().catch(() => ({}));
      const text = data.output_text ?? (data.output ?? []).flatMap((o: { content?: { text?: string }[] }) => o.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
      out.push({ json: { ...(items[i]?.json ?? {}), output: text, statusCode: res.status, usage: data.usage } });
    }
    return [out];
  }
}
