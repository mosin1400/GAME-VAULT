// ==========================================================================
// مدیریت تریگرهای زنده (Scheduler, File Watcher, MQTT Subscribe, Postgres CDC)
// این ماژول به‌صورت Singleton در حافظه‌ی پردازش سرور نگهداری می‌شود.
// ==========================================================================
import cron, { type ScheduledTask } from "node-cron";
import fs from "fs";
import path from "path";
import mqtt, { type MqttClient } from "mqtt";
import { Client } from "pg";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runWorkflowById } from "./executor";
import type { WorkflowNode } from "./types";

interface ActiveHandles {
  cronTasks: ScheduledTask[];
  watchers: fs.FSWatcher[];
  mqttClients: MqttClient[];
  pgClients: Client[];
}

const globalForTriggers = globalThis as typeof globalThis & {
  __workflowTriggerRegistry?: Map<number, ActiveHandles>;
  __workflowTriggersBootstrapped?: boolean;
};

const registry = globalForTriggers.__workflowTriggerRegistry ?? new Map<number, ActiveHandles>();
globalForTriggers.__workflowTriggerRegistry = registry;

export const FILES_DIR = path.join(process.cwd(), "files");
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

function asNodes(raw: unknown): WorkflowNode[] {
  return Array.isArray(raw) ? (raw as WorkflowNode[]) : [];
}

export async function deactivateWorkflowTriggers(workflowId: number) {
  const handles = registry.get(workflowId);
  if (!handles) return;
  handles.cronTasks.forEach((t) => t.stop());
  handles.watchers.forEach((w) => { try { w.close(); } catch { /* noop */ } });
  handles.mqttClients.forEach((c) => { try { c.end(true); } catch { /* noop */ } });
  for (const c of handles.pgClients) {
    try { await c.end(); } catch { /* noop */ }
  }
  registry.delete(workflowId);
}

export async function activateWorkflowTriggers(workflowId: number) {
  await deactivateWorkflowTriggers(workflowId);
  const rows = await db.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1);
  if (!rows.length) return;
  const wf = rows[0];
  const nodes = asNodes(wf.nodes);
  const handles: ActiveHandles = { cronTasks: [], watchers: [], mqttClients: [], pgClients: [] };

  for (const node of nodes) {
    if (node.data.disabled) continue;
    try {
      if (node.data.type === "scheduleTrigger") {
        const expr = String(node.data.parameters?.cronExpression || "*/5 * * * *");
        if (cron.validate(expr)) {
          const task = cron.schedule(expr, () => {
            runWorkflowById(workflowId, [{ json: { firedAt: new Date().toISOString() } }], "schedule", node.id).catch(() => {});
          });
          handles.cronTasks.push(task);
        }
      }

      if (node.data.type === "fileWatcherTrigger") {
        const dir = path.join(FILES_DIR, String(node.data.parameters?.directory || "."));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const watcher = fs.watch(dir, { recursive: false }, (eventType, filename) => {
          runWorkflowById(workflowId, [{ json: { eventType, filename } }], "trigger", node.id).catch(() => {});
        });
        handles.watchers.push(watcher);
      }

      if (node.data.type === "mqttTrigger") {
        const brokerUrl = String(node.data.parameters?.brokerUrl || "mqtt://127.0.0.1:1883");
        const topic = String(node.data.parameters?.topic || "#");
        const client = mqtt.connect(brokerUrl, { connectTimeout: 4000, reconnectPeriod: 5000 });
        client.on("connect", () => client.subscribe(topic));
        client.on("message", (t, message) => {
          runWorkflowById(workflowId, [{ json: { topic: t, message: message.toString() } }], "trigger", node.id).catch(() => {});
        });
        client.on("error", () => {});
        handles.mqttClients.push(client);
      }

      if (node.data.type === "postgresTrigger") {
        const table = String(node.data.parameters?.table || "");
        if (table) {
          const connStr = process.env.DATABASE_URL as string;
          const channel = `wf_notify_${workflowId}_${node.id}`.replace(/[^a-z0-9_]/gi, "_");
          const client = new Client({ connectionString: connStr });
          await client.connect();
          const fnName = `notify_${channel}`;
          await client.query(`
            CREATE OR REPLACE FUNCTION ${fnName}() RETURNS trigger AS $$
            BEGIN
              PERFORM pg_notify('${channel}', row_to_json(NEW)::text);
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
          `);
          await client.query(`DROP TRIGGER IF EXISTS ${fnName}_trg ON ${table};`);
          await client.query(`
            CREATE TRIGGER ${fnName}_trg
            AFTER INSERT OR UPDATE OR DELETE ON ${table}
            FOR EACH ROW EXECUTE FUNCTION ${fnName}();
          `);
          await client.query(`LISTEN ${channel}`);
          client.on("notification", (msg) => {
            let payload: unknown = msg.payload;
            try { payload = JSON.parse(msg.payload || "{}"); } catch { /* noop */ }
            runWorkflowById(workflowId, [{ json: { table, payload } }], "trigger", node.id).catch(() => {});
          });
          handles.pgClients.push(client);
        }
      }
    } catch {
      // خطای راه‌اندازی یک تریگر نباید بقیه‌ی تریگرها را متوقف کند
    }
  }

  registry.set(workflowId, handles);
}

export async function bootstrapAllTriggers() {
  if (globalForTriggers.__workflowTriggersBootstrapped) return;
  globalForTriggers.__workflowTriggersBootstrapped = true;
  try {
    const activeWorkflows = await db.select().from(workflows).where(eq(workflows.active, true));
    for (const wf of activeWorkflows) {
      await activateWorkflowTriggers(wf.id);
    }
  } catch {
    // در صورت نبود دیتابیس در زمان build، بی‌صدا رد شو
  }
}
