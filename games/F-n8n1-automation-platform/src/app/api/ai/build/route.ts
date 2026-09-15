import { loadNodeRegistry } from "@/lib/server/node-registry";
import { handlers } from "@/lib/engine/handlers";
import { chat } from "@/lib/engine/llm";
import { buildAutomation } from "@/lib/agent/builder";
import { getSessionUser } from "@/lib/server/auth";
import { db } from "@/db";
import { credentials } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
const busy = new Set<number>();

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "احراز هویت لازم است" }, { status: 401 });
  if (!["owner", "admin", "editor", "member"].includes(user.role)) return Response.json({ error: "اجازه ساخت جریان ندارید" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 12000) return Response.json({ error: "درخواست باید بین ۱ تا ۱۲۰۰۰ کاراکتر باشد" }, { status: 400 });
  const token = process.env.CODEX_ACCESS_TOKEN?.trim();
  if (!token) return Response.json({ error: "توکن Codex تنظیم نشده است. CODEX_ACCESS_TOKEN را در .env قرار دهید و برنامه را دوباره اجرا کنید.", code: "CODEX_NOT_CONFIGURED" }, { status: 503 });
  if (busy.has(user.id)) return Response.json({ error: "درخواست قبلی هنوز در حال پردازش است" }, { status: 429 });
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
  if (history.some((m: unknown) => !m || typeof m !== "object" || !["user", "assistant"].includes((m as { role: string }).role) || typeof (m as { content: string }).content !== "string" || (m as { content: string }).content.length > 12000)) return Response.json({ error: "تاریخچه نامعتبر است" }, { status: 400 });
  const excluded = new Set((process.env.NODES_EXCLUDE ?? "").split(",").map((s) => s.trim()));
  const shell = process.env.ALLOW_SHELL_NODES !== "false";
  busy.add(user.id);
  try {
    const registry = await loadNodeRegistry();
    const catalog = registry.catalog.filter((d) => (d.handler === "customJs" || Boolean(handlers[d.handler])) && d.handler !== "noop" && !excluded.has(d.type) && (shell || !["bash", "pythonCode"].includes(d.type)));
    const summaries = await db.select({ id: credentials.id, name: credentials.name, type: credentials.type }).from(credentials);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(240000)]);
    const result = await buildAutomation({ prompt: body.prompt.trim(), history, catalog, credentials: summaries, allowNodeCreation: ["owner", "admin"].includes(user.role), signal, call: async (messages) => {
      const response = await chat({ provider: "codex", model: process.env.CODEX_MODEL || "gpt-5-codex", apiKey: token, baseUrl: process.env.CODEX_BASE_URL, timeoutMs: 90000, signal }, messages);
      if (response.simulated) throw new Error("Codex اتصال واقعی ندارد");
      return response.text;
    } });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("ایجنت") ? error.message : "ساخت جریان ناموفق بود. اعتبار توکن، CODEX_ACCOUNT_ID، مدل و آدرس Codex را بررسی کنید؛ برای توکن جدید برنامه را دوباره اجرا کنید.";
    return Response.json({ error: message, code: "AGENT_FAILED" }, { status: 502 });
  } finally { busy.delete(user.id); }
}
