/**
 * اتصال مغز Agent به Codex
 * -------------------------
 * چهار ارائه‌دهنده به ترتیب اولویت (قابل تنظیم با CODEX_MODE):
 *
 *  1. codex-cli          : اجرای مستقیم `codex exec` روی سرور (احراز هویت با `codex login` — اشتراک ChatGPT کاربر)
 *  2. codex-n8n          : فراخوانی Workflow پروکسی «Codex LLM Proxy» در n8n که از نود
 *                          @chrishdx/n8n-nodes-codex-cli-lm استفاده می‌کند  (N8N_CODEX_WEBHOOK_URL)
 *  3. openai-compatible  : هر API سازگار با OpenAI                          (OPENAI_API_KEY, OPENAI_BASE_URL)
 *  4. heuristic          : موتور قالب‌محور داخلی — همیشه در دسترس
 *
 * CODEX_MODE=auto (پیش‌فرض) → اولین ارائه‌دهندهٔ در دسترس انتخاب می‌شود.
 */
import { execFile } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { SYSTEM_INSTRUCTION } from "./prompt";
import { buildFromTemplate } from "./templates";
import { extractJson } from "./validator";
import type { GenerationResult, LlmProvider, N8nWorkflow } from "./types";

const execFileAsync = promisify(execFile);

/** زمان‌بندی‌ها */
const CLI_TIMEOUT_MS = Number(process.env.CODEX_TIMEOUT_MS ?? 180_000);
const HTTP_TIMEOUT_MS = 120_000;

/** آیا باینری codex روی سیستم موجود است؟ (نتیجه cache می‌شود) */
let codexBinaryAvailable: boolean | null = null;
export async function isCodexCliAvailable(): Promise<boolean> {
  if (codexBinaryAvailable !== null) return codexBinaryAvailable;
  try {
    await execFileAsync(process.env.CODEX_BIN ?? "codex", ["--version"], { timeout: 10_000 });
    codexBinaryAvailable = true;
  } catch {
    codexBinaryAvailable = false;
  }
  return codexBinaryAvailable;
}

/** وضعیت ارائه‌دهنده‌ها برای نمایش در داشبورد */
export async function getProviderStatus() {
  return {
    mode: process.env.CODEX_MODE ?? "auto",
    codexCli: await isCodexCliAvailable(),
    codexN8n: Boolean(process.env.N8N_CODEX_WEBHOOK_URL),
    openaiCompatible: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.CODEX_MODEL ?? "gpt-5-codex",
  };
}

/** انتخاب ارائه‌دهنده بر اساس تنظیمات و در دسترس بودن */
export async function resolveProvider(): Promise<LlmProvider> {
  const mode = (process.env.CODEX_MODE ?? "auto") as LlmProvider | "auto";
  if (mode !== "auto") return mode;
  if (await isCodexCliAvailable()) return "codex-cli";
  if (process.env.N8N_CODEX_WEBHOOK_URL) return "codex-n8n";
  if (process.env.OPENAI_API_KEY) return "openai-compatible";
  return "heuristic";
}

/* ------------------------------------------------------------------ */
/* ارائه‌دهندهٔ ۱: Codex CLI                                           */
/* ------------------------------------------------------------------ */
async function runCodexCli(system: string, user: string): Promise<string> {
  // یک پوشهٔ موقت ایزوله برای اجرای codex (تا به فایل‌های پروژه دست نزند)
  const dir = await mkdtemp(join(tmpdir(), "codex-agent-"));
  const outFile = join(dir, "last-message.md");
  const fullPrompt = `${system}\n\n${user}`;
  try {
    await execFileAsync(
      process.env.CODEX_BIN ?? "codex",
      [
        "exec",
        "--skip-git-repo-check", // پوشهٔ موقت، مخزن git نیست
        "--ephemeral", // بدون ذخیرهٔ session
        "--sandbox",
        "read-only", // مدل فقط باید متن تولید کند
        "-C",
        dir,
        "-m",
        process.env.CODEX_MODEL ?? "gpt-5-codex",
        "--output-last-message",
        outFile,
        fullPrompt,
      ],
      { timeout: CLI_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024, env: { ...process.env, CI: "1" } },
    );
    return await readFile(outFile, "utf8");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/* ارائه‌دهندهٔ ۲: پروکسی Codex در n8n                                  */
/* ------------------------------------------------------------------ */
async function runCodexViaN8n(system: string, user: string): Promise<string> {
  const url = process.env.N8N_CODEX_WEBHOOK_URL!;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.N8N_CODEX_WEBHOOK_SECRET
        ? { "X-Agent-Secret": process.env.N8N_CODEX_WEBHOOK_SECRET }
        : {}),
    },
    body: JSON.stringify({ system, prompt: user }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`n8n Codex proxy returned ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { output?: string; text?: string; response?: string };
  const text = data.output ?? data.text ?? data.response;
  if (!text) throw new Error("n8n Codex proxy returned no text");
  return text;
}

/* ------------------------------------------------------------------ */
/* ارائه‌دهندهٔ ۳: API سازگار با OpenAI                                */
/* ------------------------------------------------------------------ */
async function runOpenAiCompatible(system: string, user: string): Promise<string> {
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.CODEX_MODEL ?? "gpt-5-codex",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OpenAI-compatible API returned ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Model returned empty content");
  return text;
}

/* ------------------------------------------------------------------ */
/* نقطهٔ ورود: تولید Workflow                                           */
/* ------------------------------------------------------------------ */

/**
 * تولید Workflow از روی درخواست کاربر.
 * در صورت خطای ارائه‌دهندهٔ اصلی، به‌صورت خودکار به موتور قالب‌محور سقوط می‌کند
 * تا سیستم هرگز بدون خروجی نماند.
 */
export async function generateWorkflow(
  userPrompt: string,
  originalRequest: string,
  onLog?: (msg: string, data?: unknown) => Promise<void> | void,
): Promise<GenerationResult> {
  const provider = await resolveProvider();
  await onLog?.(`ارائه‌دهندهٔ مدل انتخاب شد: ${provider}`);

  if (provider === "heuristic") {
    const { workflow, explanation } = buildFromTemplate(originalRequest);
    return { provider, workflow, explanation };
  }

  try {
    let raw: string;
    if (provider === "codex-cli") raw = await runCodexCli(SYSTEM_INSTRUCTION, userPrompt);
    else if (provider === "codex-n8n") raw = await runCodexViaN8n(SYSTEM_INSTRUCTION, userPrompt);
    else raw = await runOpenAiCompatible(SYSTEM_INSTRUCTION, userPrompt);

    await onLog?.("پاسخ خام مدل دریافت شد", { chars: raw.length });
    const json = extractJson(raw) as N8nWorkflow;
    return { provider, workflow: json, rawText: raw };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await onLog?.(`خطای ارائه‌دهندهٔ ${provider}؛ سقوط به موتور قالب‌محور: ${message}`);
    const { workflow, explanation } = buildFromTemplate(originalRequest);
    return { provider: "heuristic", workflow, explanation: `${explanation} (fallback)` };
  }
}
