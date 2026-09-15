// ============================================================================
// Database Trigger (CDC) – شروع جریان با INSERT/UPDATE/DELETE در PostgreSQL
// حالت LISTEN/NOTIFY: تریگر و تابع pg به‌صورت خودکار روی جدول ساخته می‌شود.
// حالت Polling: بر اساس ستون افزایشی (id/updated_at) رکوردهای جدید بررسی می‌شوند.
// ============================================================================
import { Client } from "pg";
import type { INodeType, TriggerContext } from "../types";

export class DatabaseTrigger implements INodeType {
  description = {
    displayName: "Database Trigger (CDC)",
    name: "databaseTrigger",
    group: ["trigger" as const],
    version: 1,
    description: "Change Data Capture برای PostgreSQL",
    icon: "fa:database",
    defaults: { name: "DB Trigger", color: "#336791" },
    inputs: [],
    outputs: ["main"],
    credentials: [{ name: "postgres", required: true }],
    properties: [
      { displayName: "Mode", name: "mode", type: "options" as const, default: "listen", options: [{ name: "LISTEN/NOTIFY (real-time)", value: "listen" }, { name: "Polling", value: "poll" }] },
      { displayName: "Schema", name: "schema", type: "string" as const, default: "public" },
      { displayName: "Table", name: "table", type: "string" as const, default: "", required: true },
      { displayName: "Events", name: "events", type: "options" as const, default: "all", options: [{ name: "All", value: "all" }, { name: "INSERT", value: "INSERT" }, { name: "UPDATE", value: "UPDATE" }, { name: "DELETE", value: "DELETE" }] },
      { displayName: "Poll Column (polling)", name: "pollColumn", type: "string" as const, default: "id" },
      { displayName: "Poll Interval (sec)", name: "interval", type: "number" as const, default: 30 },
    ],
  };

  async trigger(this: TriggerContext) {
    const cred = await this.getCredentials("postgres");
    const mode = String(this.getNodeParameter("mode", 0, "listen"));
    const schema = String(this.getNodeParameter("schema", 0, "public"));
    const table = String(this.getNodeParameter("table", 0, ""));
    const events = String(this.getNodeParameter("events", 0, "all"));
    const client = new Client({ connectionString: cred.connectionString });
    await client.connect();
    const channel = `flowforge_${table}`;

    if (mode === "listen") {
      // ساخت تابع و تریگر CDC (idempotent)
      await client.query(`
        CREATE OR REPLACE FUNCTION ${schema}.ff_notify_${table}() RETURNS trigger AS $$
        BEGIN
          PERFORM pg_notify('${channel}', json_build_object('op', TG_OP, 'table', TG_TABLE_NAME, 'old', row_to_json(OLD), 'new', row_to_json(NEW), 'ts', now())::text);
          RETURN COALESCE(NEW, OLD);
        END; $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS ff_cdc_${table} ON ${schema}.${table};
        CREATE TRIGGER ff_cdc_${table} AFTER INSERT OR UPDATE OR DELETE ON ${schema}.${table}
          FOR EACH ROW EXECUTE FUNCTION ${schema}.ff_notify_${table}();
      `);
      await client.query(`LISTEN ${channel}`);
      client.on("notification", (msg) => {
        if (!msg.payload) return;
        const data = JSON.parse(msg.payload);
        if (events !== "all" && data.op !== events) return;
        this.emit([[{ json: data }]]);
      });
      this.logger.info(`CDC listening on ${schema}.${table} (${channel})`);
      return { closeFunction: async () => { await client.query(`UNLISTEN ${channel}`); await client.end(); } };
    }

    // Polling
    const col = String(this.getNodeParameter("pollColumn", 0, "id"));
    const interval = Number(this.getNodeParameter("interval", 0, 30)) * 1000;
    const last = await client.query(`SELECT max(${col}) AS m FROM ${schema}.${table}`);
    let cursor = last.rows[0]?.m ?? null;
    const timer = setInterval(async () => {
      try {
        const r = cursor == null ? await client.query(`SELECT * FROM ${schema}.${table} ORDER BY ${col} ASC LIMIT 100`) : await client.query(`SELECT * FROM ${schema}.${table} WHERE ${col} > $1 ORDER BY ${col} ASC LIMIT 100`, [cursor]);
        if (r.rows.length) { cursor = r.rows[r.rows.length - 1][col]; this.emit([r.rows.map((row) => ({ json: { op: "INSERT", table, new: row } }))]); }
      } catch (e) { this.logger.error(`poll error: ${(e as Error).message}`); }
    }, interval);
    return { closeFunction: async () => { clearInterval(timer); await client.end(); } };
  }
}
