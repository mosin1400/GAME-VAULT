// ============================================================================
// MQTT Client Node – Publish / Subscribe (MQTT 3.1.1 روی TCP، بدون وابستگی)
// برای TLS/WebSocket و QoS 2 می‌توانید پکیج `mqtt` را جایگزین کنید.
// ============================================================================
import net from "node:net";
import type { INodeType, ExecuteContext, TriggerContext, Item } from "../types";

const encStr = (s: string) => { const b = Buffer.from(s); return Buffer.concat([Buffer.from([b.length >> 8, b.length & 255]), b]); };
const remLen = (n: number) => { const out: number[] = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; out.push(d); } while (n > 0); return Buffer.from(out); };

/** اتصال به بروکر و ارسال CONNECT؛ resolve پس از CONNACK */
function connect(url: string, user?: string, pass?: string, clientId = `ff-${Date.now()}`): Promise<net.Socket> {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const s = net.createConnection(Number(u.port || 1883), u.hostname);
    let flags = 0x02; const parts = [encStr("MQTT"), Buffer.from([4]), Buffer.alloc(1), Buffer.from([0, 60]), encStr(clientId)];
    if (user) { flags |= 0x80; parts.push(encStr(user)); } if (pass) { flags |= 0x40; parts.push(encStr(pass)); }
    parts[2] = Buffer.from([flags]);
    const vh = Buffer.concat(parts);
    s.on("connect", () => s.write(Buffer.concat([Buffer.from([0x10]), remLen(vh.length), vh])));
    s.once("data", (d) => (d[0] === 0x20 && d[3] === 0 ? resolve(s) : reject(new Error(`CONNACK code ${d[3]}`))));
    s.on("error", reject);
  });
}

export class MqttClient implements INodeType {
  description = {
    displayName: "MQTT Client",
    name: "mqttClient",
    group: ["output" as const, "trigger" as const],
    version: 1,
    description: "Publish به بروکر MQTT یا Subscribe (تریگر)",
    icon: "fa:broadcast-tower",
    defaults: { name: "MQTT", color: "#0f766e" },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      { displayName: "Broker URL", name: "brokerUrl", type: "string" as const, default: "mqtt://localhost:1883" },
      { displayName: "Username", name: "username", type: "string" as const, default: "" },
      { displayName: "Password", name: "password", type: "string" as const, default: "", typeOptions: { password: true } },
      { displayName: "Topic", name: "topic", type: "string" as const, default: "flowforge/events" },
      { displayName: "Message (publish)", name: "message", type: "string" as const, default: "={{ JSON.stringify($json) }}" },
      { displayName: "Retain", name: "retain", type: "boolean" as const, default: false },
    ],
  };

  /** Publish */
  async execute(this: ExecuteContext): Promise<Item[][]> {
    const items = this.getInputData();
    const out: Item[] = [];
    const s = await connect(String(this.getNodeParameter("brokerUrl", 0, "mqtt://localhost:1883")), String(this.getNodeParameter("username", 0, "")) || undefined, String(this.getNodeParameter("password", 0, "")) || undefined);
    try {
      for (let i = 0; i < Math.max(items.length, 1); i++) {
        const topic = String(this.getNodeParameter("topic", i, ""));
        const msg = Buffer.from(String(this.getNodeParameter("message", i, "")));
        const retain = Boolean(this.getNodeParameter("retain", i, false)) ? 1 : 0;
        const body = Buffer.concat([encStr(topic), msg]);
        s.write(Buffer.concat([Buffer.from([0x30 | retain]), remLen(body.length), body]));
        out.push({ json: { topic, bytes: msg.length, published: true } });
      }
      await new Promise((r) => setTimeout(r, 50));
      s.write(Buffer.from([0xe0, 0])); // DISCONNECT
    } finally { s.end(); }
    return [out];
  }

  /** Subscribe (trigger) */
  async trigger(this: TriggerContext) {
    const topic = String(this.getNodeParameter("topic", 0, "#"));
    const s = await connect(String(this.getNodeParameter("brokerUrl", 0, "mqtt://localhost:1883")), String(this.getNodeParameter("username", 0, "")) || undefined, String(this.getNodeParameter("password", 0, "")) || undefined, `ff-sub-${Date.now()}`);
    const body = Buffer.concat([Buffer.from([0, 1]), encStr(topic), Buffer.from([0])]);
    s.write(Buffer.concat([Buffer.from([0x82]), remLen(body.length), body])); // SUBSCRIBE QoS0
    const ping = setInterval(() => s.write(Buffer.from([0xc0, 0])), 30000);
    s.on("data", (buf: Buffer) => {
      let off = 0;
      while (off < buf.length) {
        const type = buf[off] >> 4; let mult = 1, len = 0, p = off + 1;
        do { len += (buf[p] & 127) * mult; mult *= 128; } while (buf[p++] & 128);
        const frame = buf.subarray(p, p + len);
        if (type === 3) {
          const tl = frame.readUInt16BE(0); const t = frame.subarray(2, 2 + tl).toString(); const payload = frame.subarray(2 + tl).toString();
          let data: unknown = payload; try { data = JSON.parse(payload); } catch { /* raw */ }
          this.emit([[{ json: { topic: t, payload: data, receivedAt: new Date().toISOString() } }]]);
        }
        off = p + len;
      }
    });
    return { closeFunction: async () => { clearInterval(ping); s.end(); } };
  }
}
