// ==========================================================================
// نودهای هوش مصنوعی: AI Agent (اتصال به هر LLM از جمله OpenAI/Codex/Ollama)
// و Pipeline کامل RAG (Ingestion -> Embedding -> Retrieval -> Generation)
// ==========================================================================
import { db } from "@/db";
import { vectorDocuments } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import type { FlowItem, NodeDefinition } from "../types";
import { buildScope, resolveExpressionDeep } from "../expression";

const EMBED_DIM = 256;

/** امبدینگ افلاین ساده (Hashing Trick) برای زمانی که API Key موجود نیست */
function offlineEmbedding(text: string): number[] {
  const vec = new Array(EMBED_DIM).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9\u0600-\u06FF]+/).filter(Boolean);
  for (const token of tokens) {
    const hash = crypto.createHash("md5").update(token).digest();
    const idx = hash.readUInt32BE(0) % EMBED_DIM;
    vec[idx] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

async function getEmbedding(text: string, apiKey?: string, baseUrl?: string): Promise<number[]> {
  if (!apiKey) return offlineEmbedding(text);
  try {
    const res = await fetch(`${baseUrl || "https://api.openai.com/v1"}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) return offlineEmbedding(text);
    const json = await res.json();
    return json.data?.[0]?.embedding ?? offlineEmbedding(text);
  } catch {
    return offlineEmbedding(text);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export const aiAgentNode: NodeDefinition = {
  type: "aiAgent",
  name: "AI Agent (LLM دلخواه)",
  group: "ai",
  category: "AI",
  icon: "🤖",
  color: "#10a37f",
  description: "گفتگو با هر مدل زبانی سازگار با OpenAI (OpenAI، Codex، Ollama محلی و ...) با حافظه و Prompt سیستمی",
  credentialType: "llmApi",
  properties: [
    { name: "provider", label: "ارائه‌دهنده", type: "options", default: "openai", options: [
      { label: "OpenAI / سازگار با OpenAI (Codex, Ollama, ...)", value: "openai" },
      { label: "Anthropic (Claude)", value: "anthropic" },
    ] },
    { name: "model", label: "مدل", type: "string", default: "gpt-4o-mini" },
    { name: "systemPrompt", label: "System Prompt", type: "text", rows: 4, default: "شما یک دستیار هوشمند مفید هستید." },
    { name: "userMessage", label: "پیام کاربر", type: "text", rows: 4, default: "{{$json.message}}" },
    { name: "temperature", label: "Temperature", type: "number", default: 0.7 },
  ],
  execute: async (ctx) => {
    const scope = buildScope(ctx.items[0] ?? { json: {} }, 0, ctx.items, {});
    const userMessage = String(resolveExpressionDeep(ctx.parameters.userMessage, scope) ?? "");
    const cred = ctx.credential as { apiKey?: string; baseUrl?: string } | null;
    const provider = String(ctx.parameters.provider || "openai");
    const model = String(ctx.parameters.model || "gpt-4o-mini");
    const apiKey = cred?.apiKey || process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY || "";
    const baseUrl = cred?.baseUrl || (provider === "anthropic" ? "https://api.anthropic.com/v1" : "https://api.openai.com/v1");

    if (!apiKey) {
      return [{ json: { ok: false, reply: null, error: "کلید API برای LLM تنظیم نشده است. یک Credential از نوع llmApi بسازید یا OPENAI_API_KEY را در محیط تنظیم کنید." } }];
    }

    try {
      if (provider === "anthropic") {
        const res = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            system: ctx.parameters.systemPrompt,
            messages: [{ role: "user", content: userMessage }],
          }),
        });
        const json = await res.json();
        const reply = json?.content?.[0]?.text ?? null;
        return [{ json: { ok: res.ok, reply, raw: json } }];
      }
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: Number(ctx.parameters.temperature) || 0.7,
          messages: [
            { role: "system", content: ctx.parameters.systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });
      const json = await res.json();
      const reply = json?.choices?.[0]?.message?.content ?? null;
      return [{ json: { ok: res.ok, reply, raw: json } }];
    } catch (err) {
      return [{ json: { ok: false, error: (err as Error).message } }];
    }
  },
};

export const vectorStoreInsertNode: NodeDefinition = {
  type: "vectorStoreInsert",
  name: "RAG: افزودن سند به پایگاه‌دانش",
  group: "ai",
  category: "AI",
  icon: "📚",
  color: "#10a37f",
  description: "Ingestion: محاسبه‌ی Embedding متن و ذخیره در پایگاه‌دانش برداری",
  credentialType: "llmApi",
  properties: [
    { name: "namespace", label: "فضای نام (Namespace)", type: "string", default: "default" },
    { name: "content", label: "محتوای متنی", type: "text", rows: 6, default: "{{$json.content}}" },
  ],
  execute: async (ctx) => {
    const cred = ctx.credential as { apiKey?: string; baseUrl?: string } | null;
    const vars: Record<string, string> = {};
    const out: FlowItem[] = [];
    for (let i = 0; i < ctx.items.length; i++) {
      const item = ctx.items[i];
      const scope = buildScope(item, i, ctx.items, vars);
      const content = String(resolveExpressionDeep(ctx.parameters.content, scope) ?? "");
      const embedding = await getEmbedding(content, cred?.apiKey, cred?.baseUrl);
      const [row] = await db
        .insert(vectorDocuments)
        .values({ namespace: String(ctx.parameters.namespace || "default"), content, embedding, metadata: item.json })
        .returning();
      out.push({ json: { id: row.id, inserted: true } });
    }
    return out;
  },
};

export const vectorStoreQueryNode: NodeDefinition = {
  type: "vectorStoreQuery",
  name: "RAG: جست‌وجوی پایگاه‌دانش (Retrieval)",
  group: "ai",
  category: "AI",
  icon: "🔎",
  color: "#10a37f",
  description: "Retrieval: یافتن مرتبط‌ترین اسناد با یک پرسش (Cosine Similarity)",
  credentialType: "llmApi",
  properties: [
    { name: "namespace", label: "فضای نام (Namespace)", type: "string", default: "default" },
    { name: "query", label: "پرسش", type: "text", default: "{{$json.query}}" },
    { name: "topK", label: "تعداد نتایج", type: "number", default: 3 },
  ],
  execute: async (ctx) => {
    const cred = ctx.credential as { apiKey?: string; baseUrl?: string } | null;
    const scope = buildScope(ctx.items[0] ?? { json: {} }, 0, ctx.items, {});
    const query = String(resolveExpressionDeep(ctx.parameters.query, scope) ?? "");
    const namespace = String(ctx.parameters.namespace || "default");
    const topK = Number(ctx.parameters.topK) || 3;
    const queryEmbedding = await getEmbedding(query, cred?.apiKey, cred?.baseUrl);
    const rows = await db.select().from(vectorDocuments).where(eq(vectorDocuments.namespace, namespace));
    const scored = rows
      .map((r) => ({ row: r, score: cosineSimilarity(queryEmbedding, (r.embedding as number[]) || []) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return [{ json: { query, results: scored.map((s) => ({ id: s.row.id, content: s.row.content, score: s.score })) } }];
  },
};

export const aiNodes: NodeDefinition[] = [aiAgentNode, vectorStoreInsertNode, vectorStoreQueryNode];
