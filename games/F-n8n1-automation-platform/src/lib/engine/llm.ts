// ============================================================================
// LLM Layer – اتصال به OpenAI / Anthropic / Gemini / Ollama / Codex / Custom
// + حافظه Agent + Embedding + Vector Store لوکال (in-process)
// ============================================================================

import { readCodexResponse } from "./codex";

export type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string };

export type LlmConfig = {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  jsonOutput?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
};

/** انتخاب کلید API از credential یا env */
export function resolveApiKey(provider: string, cred: Record<string, string>): string | undefined {
  if (cred.apiKey) return cred.apiKey;
  if (cred.accessToken) return cred.accessToken;
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "google":
      return process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
    case "openrouter":
      return process.env.OPENROUTER_API_KEY;
    case "codex":
      return process.env.CODEX_ACCESS_TOKEN;
    default:
      return process.env.LLM_API_KEY;
  }
}

/** آیا هیچ ارائه‌دهنده‌ای پیکربندی شده؟ */
export function hasAnyLlm(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      process.env.OLLAMA_URL ||
      process.env.CODEX_ACCESS_TOKEN,
  );
}

/** فراخوانی چت – برمی‌گرداند متن پاسخ */
export async function chat(cfg: LlmConfig, messages: ChatMessage[]): Promise<{ text: string; raw?: unknown; simulated?: boolean }> {
  const provider = cfg.provider || "openai";
  const temperature = cfg.temperature ?? 0.3;

  // ---------------- Ollama (لوکال) ----------------
  if (provider === "ollama") {
    const base = (cfg.baseUrl || process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: cfg.model || "llama3", messages, stream: false, options: { temperature }, ...(cfg.jsonOutput ? { format: "json" } : {}) }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { text: data.message?.content ?? "", raw: data };
  }

  // ---------------- Anthropic ----------------
  if (provider === "anthropic") {
    if (!cfg.apiKey) return simulate(messages, provider);
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const rest = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "tool" ? "user" : m.role, content: m.content }));
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: cfg.model || "claude-3-5-haiku-latest", max_tokens: 2048, system, messages: rest, temperature }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { text: data.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "", raw: data };
  }

  // ---------------- Google Gemini ----------------
  if (provider === "google") {
    if (!cfg.apiKey) return simulate(messages, provider);
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const model = cfg.model || "gemini-1.5-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents, systemInstruction: system ? { parts: [{ text: system }] } : undefined, generationConfig: { temperature, ...(cfg.jsonOutput ? { responseMimeType: "application/json" } : {}) } }),
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { text: data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "", raw: data };
  }

  // ---------------- OpenAI / Codex / OpenRouter / Custom (OpenAI-compatible) ----------------
  let base = cfg.baseUrl || "https://api.openai.com/v1";
  if (provider === "openrouter") base = cfg.baseUrl || "https://openrouter.ai/api/v1";
  if (provider === "codex") base = cfg.baseUrl || process.env.CODEX_BASE_URL || "https://chatgpt.com/backend-api/codex";
  if (provider === "custom") base = cfg.baseUrl || process.env.LLM_BASE_URL || "http://localhost:8080/v1";
  if (!cfg.apiKey && provider !== "custom" && provider !== "codex") return simulate(messages, provider);

  // Codex از endpoint /responses استفاده می‌کند (توکن از device-code auth)
  if (provider === "codex") {
    if (!cfg.apiKey) throw new Error("CODEX_NOT_CONFIGURED");
    const endpoint = new URL(`${base.replace(/\/$/, "")}/responses`);
    if (endpoint.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)) throw new Error("CODEX_REQUIRES_HTTPS");
    const res = await fetch(`${base.replace(/\/$/, "")}/responses`, {
      method: "POST",
      signal: cfg.signal ? AbortSignal.any([cfg.signal, AbortSignal.timeout(cfg.timeoutMs ?? 90000)]) : AbortSignal.timeout(cfg.timeoutMs ?? 90000),
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: `Bearer ${cfg.apiKey}`, ...(process.env.CODEX_ACCOUNT_ID ? { "ChatGPT-Account-ID": process.env.CODEX_ACCOUNT_ID } : {}) },
      body: JSON.stringify({
        model: cfg.model || "codex-mini-latest",
        instructions: messages.filter((m) => m.role === "system").map((m) => m.content).join("\n"),
        input: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "tool" ? "user" : m.role, content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }] })),
        store: false,
        stream: true,
      }),
    });
    return { text: await readCodexResponse(res) };
  }

  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
    body: JSON.stringify({
      model: cfg.model || "gpt-4o-mini",
      messages,
      temperature,
      ...(cfg.jsonOutput ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`LLM error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content ?? "", raw: data };
}

/** پاسخ شبیه‌سازی‌شده وقتی کلید API وجود ندارد (برای تست جریان) */
function simulate(messages: ChatMessage[], provider: string) {
  const last = messages.filter((m) => m.role === "user").pop()?.content ?? "";
  return {
    text: `[شبیه‌سازی ${provider}] کلید API تنظیم نشده است. پیام دریافت‌شده: "${last.slice(0, 200)}"`,
    simulated: true,
  };
}

// ---------------------------------------------------------------------------
// Agent Memory – حافظه مکالمه (در حافظه فرآیند؛ در Queue Mode به Redis منتقل می‌شود)
// ---------------------------------------------------------------------------
const g = globalThis as typeof globalThis & {
  __ffMemory?: Map<string, ChatMessage[]>;
  __ffVectors?: Map<string, { id: string; text: string; vector: number[]; metadata: Record<string, unknown> }[]>;
  __ffUpdates?: Map<string, unknown[]>;
};
g.__ffMemory ??= new Map();
g.__ffVectors ??= new Map();

export const memory = {
  get(key: string): ChatMessage[] {
    return g.__ffMemory!.get(key) ?? [];
  },
  append(key: string, msgs: ChatMessage[], max = 20) {
    const cur = [...(g.__ffMemory!.get(key) ?? []), ...msgs];
    g.__ffMemory!.set(key, cur.slice(-max));
  },
  clear(key: string) {
    g.__ffMemory!.delete(key);
  },
};

// ---------------------------------------------------------------------------
// Embeddings – OpenAI / Ollama / لوکال (hash-based برای کار آفلاین)
// ---------------------------------------------------------------------------
export async function embed(provider: string, model: string, text: string, apiKey?: string): Promise<number[]> {
  if (provider === "openai" && apiKey) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model || "text-embedding-3-small", input: text }),
    });
    if (!res.ok) throw new Error(`Embedding error ${res.status}`);
    return (await res.json()).data[0].embedding;
  }
  if (provider === "ollama") {
    const base = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
    const res = await fetch(`${base}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || "nomic-embed-text", prompt: text }),
    });
    if (!res.ok) throw new Error(`Ollama embedding error ${res.status}`);
    return (await res.json()).embedding;
  }
  return localEmbedding(text);
}

/** Embedding لوکال بر پایه هش توکن‌ها (256 بعد) – مناسب جستجوی واژگانی آفلاین */
export function localEmbedding(text: string, dim = 256): number[] {
  const v = new Array(dim).fill(0);
  const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
    v[Math.abs(h) % dim] += 1;
    // bigram
    for (let i = 0; i < t.length - 2; i++) {
      let h2 = 5381;
      for (let j = i; j < i + 3; j++) h2 = (h2 * 33) ^ t.charCodeAt(j);
      v[Math.abs(h2) % dim] += 0.5;
    }
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export function cosine(a: number[], b: number[]): number {
  let s = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    s += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return s / ((Math.sqrt(na) || 1) * (Math.sqrt(nb) || 1));
}

export const vectorStore = {
  insert(collection: string, docs: { id?: string; text: string; vector: number[]; metadata?: Record<string, unknown> }[]) {
    const arr = g.__ffVectors!.get(collection) ?? [];
    for (const d of docs) arr.push({ id: d.id ?? crypto.randomUUID(), text: d.text, vector: d.vector, metadata: d.metadata ?? {} });
    g.__ffVectors!.set(collection, arr);
    return arr.length;
  },
  search(collection: string, vector: number[], topK = 4) {
    const arr = g.__ffVectors!.get(collection) ?? [];
    return arr
      .map((d) => ({ id: d.id, text: d.text, metadata: d.metadata, score: cosine(vector, d.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  },
  clear(collection: string) {
    g.__ffVectors!.delete(collection);
  },
  count(collection: string) {
    return (g.__ffVectors!.get(collection) ?? []).length;
  },
};
