/** Read Responses JSON or SSE without requiring an SDK package. */
export async function readCodexResponse(response: Response): Promise<string> {
  if (!response.ok) throw new Error(`CODEX_HTTP_${response.status}`);
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = await response.json();
    if (data.status && data.status !== "completed") throw new Error("CODEX_INCOMPLETE");
    const text = data.output_text ?? data.output?.flatMap((o: { content?: { text?: string }[] }) => o.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
    if (!text || text.length > 100000) throw new Error("CODEX_EMPTY_OR_OVERSIZED");
    return text;
  }
  if (!response.body) throw new Error("CODEX_EMPTY_BODY");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "", text = "", completed = false, bytes = 0;
  const consume = (frame: string) => {
    const payload = frame.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
    if (!payload || payload === "[DONE]") return;
    const event = JSON.parse(payload);
    if (["error", "response.failed", "response.incomplete"].includes(event.type)) throw new Error("CODEX_RESPONSE_FAILED");
    if (event.type === "response.output_text.delta") text += event.delta ?? "";
    if (event.type === "response.completed") {
      if (event.response?.status && event.response.status !== "completed") throw new Error("CODEX_INCOMPLETE");
      completed = true;
      const output = event.response?.output;
      if (!text && Array.isArray(output)) text = output.flatMap((o: { content?: { text?: string }[] }) => o.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
    }
    if (text.length > 100000) throw new Error("CODEX_OUTPUT_TOO_LARGE");
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2000000) throw new Error("CODEX_STREAM_TOO_LARGE");
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) { consume(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); }
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
    if (!completed || !text) throw new Error("CODEX_TRUNCATED_OR_EMPTY");
    return text;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
