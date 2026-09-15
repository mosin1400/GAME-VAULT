// Worker View: وضعیت Workerها/اجراهای جاری (در Queue Mode از Redis خوانده می‌شود)
import { runningExecutions } from "@/lib/engine/executor";
import os from "os";
import { getSessionUser } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await getSessionUser(request)) return Response.json({ error: "احراز هویت لازم است" }, { status: 401 });
  const mode = process.env.EXECUTIONS_MODE ?? "regular";
  const workers = [
    { id: `main-${os.hostname()}`, role: "main", status: "online", concurrency: Number(process.env.CONCURRENCY ?? 10), running: runningExecutions.size, uptimeSec: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1048576), cpuLoad: os.loadavg()[0], version: "1.0.0" },
  ];
  if (mode === "queue") {
    const n = Number(process.env.WORKER_COUNT ?? 2);
    for (let i = 1; i <= n; i++) workers.push({ id: `worker-${i}`, role: "worker", status: process.env.REDIS_URL ? "online" : "offline", concurrency: Number(process.env.WORKER_CONCURRENCY ?? 20), running: 0, uptimeSec: Math.round(process.uptime()), memoryMb: 0, cpuLoad: 0, version: "1.0.0" });
  }
  return Response.json({ mode, redis: Boolean(process.env.REDIS_URL), multiMain: process.env.MULTI_MAIN === "true", running: [...runningExecutions.entries()].map(([id, v]) => ({ executionId: id, ...v })), workers });
}
