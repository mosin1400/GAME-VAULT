// ============================================================================
// FlowForge Worker (Queue Mode)
// از صف Redis (list: flowforge:jobs) کار می‌گیرد و از طریق API اصلی اجرا می‌کند.
// اجرا: EXECUTIONS_MODE=queue node scripts/worker.mjs
// ============================================================================
import net from "node:net";

const REDIS_URL = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
const MAIN_URL = process.env.MAIN_URL ?? "http://localhost:3000";
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 20);
let active = 0;

// کلاینت RESP حداقلی برای BRPOP
function redisCmd(...args) {
  return new Promise((resolve, reject) => {
    const s = net.createConnection(Number(REDIS_URL.port || 6379), REDIS_URL.hostname);
    let buf = "";
    s.on("connect", () => s.write(`*${args.length}\r\n` + args.map((a) => `$${Buffer.byteLength(String(a))}\r\n${a}\r\n`).join("")));
    s.on("data", (d) => { buf += d.toString(); if (buf.endsWith("\r\n")) { s.end(); resolve(buf); } });
    s.on("error", reject);
  });
}

async function loop() {
  console.log(`[worker] started – concurrency=${CONCURRENCY} main=${MAIN_URL}`);
  while (true) {
    if (active >= CONCURRENCY) { await new Promise((r) => setTimeout(r, 200)); continue; }
    try {
      const res = await redisCmd("BRPOP", "flowforge:jobs", "5");
      const m = res.match(/\$\d+\r\n(\{.*\})\r\n/s);
      if (!m) continue;
      const job = JSON.parse(m[1]);
      active++;
      fetch(`${MAIN_URL}/api/workflows/${job.workflowId}/execute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: job.mode ?? "queue", triggerData: job.triggerData }) })
        .then((r) => r.json()).then((r) => console.log(`[worker] job wf=${job.workflowId} → ${r.status} (${r.durationMs}ms)`))
        .catch((e) => console.error("[worker] error", e.message))
        .finally(() => active--);
    } catch (e) { console.error("[worker] redis error", e.message); await new Promise((r) => setTimeout(r, 3000)); }
  }
}
loop();
