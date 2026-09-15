// ==========================================================================
// نودهای شبکه/HTTP/IoT: HTTP Request، WebSocket، TCP/UDP، MQTT، Modbus
// ==========================================================================
import net from "net";
import dgram from "dgram";
import mqtt from "mqtt";
import type { ExecuteContext, FlowItem, NodeDefinition } from "../types";
import { buildScope, resolveExpressionDeep } from "../expression";

export const httpRequestNode: NodeDefinition = {
  type: "httpRequest",
  name: "HTTP Request",
  group: "action",
  category: "HTTP & API",
  icon: "🌍",
  color: "#2563eb",
  description: "ارسال درخواست HTTP به هر API (همه‌ی متدها، Header و Body سفارشی)",
  properties: [
    { name: "method", label: "متد", type: "options", default: "GET", options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ label: m, value: m })) },
    { name: "url", label: "URL", type: "string", required: true, default: "https://api.example.com" },
    { name: "headersJson", label: "Headers (JSON)", type: "json", default: "{}" },
    { name: "bodyType", label: "نوع Body", type: "options", default: "json", options: [
      { label: "JSON", value: "json" },
      { label: "Form URL Encoded", value: "form" },
      { label: "متن خام", value: "raw" },
      { label: "بدون Body", value: "none" },
    ] },
    { name: "bodyJson", label: "Body", type: "json", default: "{}" },
  ],
  execute: async (ctx) => {
    const vars: Record<string, string> = {};
    const out: FlowItem[] = [];
    for (let i = 0; i < Math.max(1, ctx.items.length); i++) {
      const item = ctx.items[i] ?? { json: {} };
      const scope = buildScope(item, i, ctx.items, vars);
      const url = String(resolveExpressionDeep(ctx.parameters.url, scope));
      const method = String(ctx.parameters.method || "GET");
      let headers: Record<string, string> = {};
      try { headers = JSON.parse(String(resolveExpressionDeep(ctx.parameters.headersJson || "{}", scope))); } catch { /* ignore */ }
      let body: BodyInit | undefined;
      const bodyType = ctx.parameters.bodyType || "json";
      if (bodyType !== "none" && method !== "GET") {
        const rawBody = resolveExpressionDeep(ctx.parameters.bodyJson ?? "{}", scope);
        if (bodyType === "json") {
          headers["Content-Type"] = headers["Content-Type"] || "application/json";
          body = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
        } else if (bodyType === "form") {
          const obj = typeof rawBody === "string" ? JSON.parse(rawBody || "{}") : (rawBody as Record<string, unknown>);
          body = new URLSearchParams(Object.entries(obj).map(([k, v]) => [k, String(v)])).toString();
          headers["Content-Type"] = headers["Content-Type"] || "application/x-www-form-urlencoded";
        } else {
          body = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
        }
      }
      try {
        const res = await fetch(url, { method, headers, body });
        const text = await res.text();
        let json: unknown;
        try { json = JSON.parse(text); } catch { json = text; }
        out.push({ json: { statusCode: res.status, ok: res.ok, response: json } });
      } catch (err) {
        out.push({ json: { statusCode: 0, ok: false, error: (err as Error).message } });
      }
    }
    return out;
  },
};

export const graphqlNode: NodeDefinition = {
  type: "graphql",
  name: "GraphQL",
  group: "action",
  category: "HTTP & API",
  icon: "◈",
  color: "#e10098",
  description: "اجرای Query/Mutation روی یک Endpoint گراف‌کیوال",
  properties: [
    { name: "endpoint", label: "Endpoint URL", type: "string", required: true },
    { name: "query", label: "Query/Mutation", type: "code", rows: 8, default: "query { __typename }" },
    { name: "variablesJson", label: "Variables (JSON)", type: "json", default: "{}" },
    { name: "headersJson", label: "Headers (JSON)", type: "json", default: "{}" },
  ],
  execute: async (ctx) => {
    const headers = JSON.parse(String(ctx.parameters.headersJson || "{}"));
    const variables = JSON.parse(String(ctx.parameters.variablesJson || "{}"));
    const res = await fetch(String(ctx.parameters.endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ query: ctx.parameters.query, variables }),
    });
    const json = await res.json();
    return [{ json: { statusCode: res.status, ...json } }];
  },
};

export const webSocketClientNode: NodeDefinition = {
  type: "webSocketClient",
  name: "WebSocket Client",
  group: "iot",
  category: "IoT & Network",
  icon: "🔌",
  color: "#7c3aed",
  description: "ارسال پیام به یک سرور WebSocket و دریافت اولین پاسخ",
  properties: [
    { name: "url", label: "آدرس ws(s)://", type: "string", required: true },
    { name: "message", label: "پیام ارسالی", type: "text", default: "{{$json.message}}" },
    { name: "timeoutMs", label: "Timeout (ms)", type: "number", default: 5000 },
  ],
  execute: async (ctx) => {
    const vars: Record<string, string> = {};
    const scope = buildScope(ctx.items[0] ?? { json: {} }, 0, ctx.items, vars);
    const message = String(resolveExpressionDeep(ctx.parameters.message, scope) ?? "");
    const url = String(ctx.parameters.url);
    const timeoutMs = Number(ctx.parameters.timeoutMs) || 5000;
    return new Promise<FlowItem[]>((resolve) => {
      let settled = false;
      const WS = (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket;
      const ws = new WS(url);
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch { /* noop */ }
        resolve([{ json: { ok: false, error: "timeout" } }]);
      }, timeoutMs);
      ws.addEventListener("open", () => { try { ws.send(message); } catch { /* noop */ } });
      ws.addEventListener("message", (ev: MessageEvent) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve([{ json: { ok: true, data: String(ev.data) } }]);
        try { ws.close(); } catch { /* noop */ }
      });
      ws.addEventListener("error", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve([{ json: { ok: false, error: "websocket error" } }]);
      });
    });
  },
};

export const tcpSocketNode: NodeDefinition = {
  type: "tcpSocket",
  name: "TCP Socket",
  group: "iot",
  category: "IoT & Network",
  icon: "🔗",
  color: "#7c3aed",
  description: "اتصال به هر سرور TCP در شبکه‌ی محلی، ارسال داده و دریافت پاسخ",
  properties: [
    { name: "host", label: "Host", type: "string", required: true, default: "127.0.0.1" },
    { name: "port", label: "Port", type: "number", required: true, default: 9000 },
    { name: "data", label: "داده‌ی ارسالی", type: "text", default: "{{$json.data}}" },
    { name: "timeoutMs", label: "Timeout (ms)", type: "number", default: 3000 },
  ],
  execute: async (ctx) => {
    const vars: Record<string, string> = {};
    const scope = buildScope(ctx.items[0] ?? { json: {} }, 0, ctx.items, vars);
    const data = String(resolveExpressionDeep(ctx.parameters.data, scope) ?? "");
    const host = String(ctx.parameters.host);
    const port = Number(ctx.parameters.port);
    const timeoutMs = Number(ctx.parameters.timeoutMs) || 3000;
    return new Promise<FlowItem[]>((resolve) => {
      const socket = new net.Socket();
      let response = "";
      let settled = false;
      const finish = (json: Record<string, unknown>) => {
        if (settled) return;
        settled = true;
        try { socket.destroy(); } catch { /* noop */ }
        resolve([{ json }]);
      };
      socket.setTimeout(timeoutMs);
      socket.connect(port, host, () => socket.write(data));
      socket.on("data", (chunk) => { response += chunk.toString(); });
      socket.on("timeout", () => finish({ ok: true, response, note: "timeout reached, closing" }));
      socket.on("error", (err) => finish({ ok: false, error: err.message }));
      socket.on("close", () => finish({ ok: true, response }));
    });
  },
};

export const udpSocketNode: NodeDefinition = {
  type: "udpSocket",
  name: "UDP Socket",
  group: "iot",
  category: "IoT & Network",
  icon: "📡",
  color: "#7c3aed",
  description: "ارسال یک بسته UDP به هاست/پورت مشخص در شبکه‌ی محلی",
  properties: [
    { name: "host", label: "Host", type: "string", required: true, default: "127.0.0.1" },
    { name: "port", label: "Port", type: "number", required: true, default: 9001 },
    { name: "data", label: "داده‌ی ارسالی", type: "text", default: "{{$json.data}}" },
  ],
  execute: async (ctx) => {
    const vars: Record<string, string> = {};
    const scope = buildScope(ctx.items[0] ?? { json: {} }, 0, ctx.items, vars);
    const data = String(resolveExpressionDeep(ctx.parameters.data, scope) ?? "");
    const host = String(ctx.parameters.host);
    const port = Number(ctx.parameters.port);
    return new Promise<FlowItem[]>((resolve) => {
      const socket = dgram.createSocket("udp4");
      const buf = Buffer.from(data);
      socket.send(buf, port, host, (err) => {
        socket.close();
        resolve([{ json: { ok: !err, error: err ? err.message : null, bytesSent: buf.length } }]);
      });
    });
  },
};

export const mqttClientNode: NodeDefinition = {
  type: "mqttPublish",
  name: "MQTT Publish",
  group: "iot",
  category: "IoT & Network",
  icon: "📶",
  color: "#7c3aed",
  description: "انتشار (Publish) یک پیام روی بروکر MQTT محلی",
  properties: [
    { name: "brokerUrl", label: "آدرس بروکر (mqtt://host:1883)", type: "string", required: true, default: "mqtt://127.0.0.1:1883" },
    { name: "topic", label: "Topic", type: "string", required: true },
    { name: "message", label: "پیام", type: "text", default: "{{$json.message}}" },
    { name: "qos", label: "QoS", type: "options", default: "0", options: [{ label: "0", value: "0" }, { label: "1", value: "1" }, { label: "2", value: "2" }] },
  ],
  execute: async (ctx) => {
    const vars: Record<string, string> = {};
    const scope = buildScope(ctx.items[0] ?? { json: {} }, 0, ctx.items, vars);
    const message = String(resolveExpressionDeep(ctx.parameters.message, scope) ?? "");
    return new Promise<FlowItem[]>((resolve) => {
      const client = mqtt.connect(String(ctx.parameters.brokerUrl), { connectTimeout: 4000 });
      const timer = setTimeout(() => {
        try { client.end(true); } catch { /* noop */ }
        resolve([{ json: { ok: false, error: "اتصال به بروکر MQTT برقرار نشد (timeout)" } }]);
      }, 5000);
      client.on("connect", () => {
        client.publish(String(ctx.parameters.topic), message, { qos: Number(ctx.parameters.qos) as 0 | 1 | 2 }, (err) => {
          clearTimeout(timer);
          client.end();
          resolve([{ json: { ok: !err, error: err ? err.message : null } }]);
        });
      });
      client.on("error", (err) => {
        clearTimeout(timer);
        try { client.end(true); } catch { /* noop */ }
        resolve([{ json: { ok: false, error: err.message } }]);
      });
    });
  },
};

// --------------------------------------------------------------------------
// Modbus TCP (پیاده‌سازی سبک پروتکل بدون وابستگی خارجی) - Read/Write Register
// --------------------------------------------------------------------------
function buildModbusReadFrame(transactionId: number, unitId: number, startAddr: number, quantity: number): Buffer {
  const buf = Buffer.alloc(12);
  buf.writeUInt16BE(transactionId, 0); // Transaction ID
  buf.writeUInt16BE(0, 2); // Protocol ID (Modbus = 0)
  buf.writeUInt16BE(6, 4); // Length
  buf.writeUInt8(unitId, 6); // Unit ID
  buf.writeUInt8(3, 7); // Function Code 3 = Read Holding Registers
  buf.writeUInt16BE(startAddr, 8);
  buf.writeUInt16BE(quantity, 10);
  return buf;
}

function buildModbusWriteFrame(transactionId: number, unitId: number, addr: number, value: number): Buffer {
  const buf = Buffer.alloc(12);
  buf.writeUInt16BE(transactionId, 0);
  buf.writeUInt16BE(0, 2);
  buf.writeUInt16BE(6, 4);
  buf.writeUInt8(unitId, 6);
  buf.writeUInt8(6, 7); // Function Code 6 = Write Single Register
  buf.writeUInt16BE(addr, 8);
  buf.writeUInt16BE(value, 10);
  return buf;
}

export const modbusNode: NodeDefinition = {
  type: "modbus",
  name: "Modbus TCP",
  group: "iot",
  category: "IoT & Network",
  icon: "🏭",
  color: "#7c3aed",
  description: "ارتباط با دستگاه‌های صنعتی از طریق پروتکل Modbus/TCP (خواندن/نوشتن رجیستر)",
  properties: [
    { name: "host", label: "Host", type: "string", required: true, default: "127.0.0.1" },
    { name: "port", label: "Port", type: "number", default: 502 },
    { name: "unitId", label: "Unit/Slave ID", type: "number", default: 1 },
    { name: "operation", label: "عملیات", type: "options", default: "read", options: [
      { label: "خواندن رجیسترهای Holding", value: "read" },
      { label: "نوشتن روی یک رجیستر", value: "write" },
    ] },
    { name: "address", label: "آدرس شروع", type: "number", default: 0 },
    { name: "quantity", label: "تعداد (برای خواندن)", type: "number", default: 1 },
    { name: "value", label: "مقدار (برای نوشتن)", type: "number", default: 0 },
    { name: "timeoutMs", label: "Timeout (ms)", type: "number", default: 3000 },
  ],
  execute: async (ctx) => {
    const host = String(ctx.parameters.host);
    const port = Number(ctx.parameters.port) || 502;
    const unitId = Number(ctx.parameters.unitId) || 1;
    const isWrite = ctx.parameters.operation === "write";
    const frame = isWrite
      ? buildModbusWriteFrame(1, unitId, Number(ctx.parameters.address) || 0, Number(ctx.parameters.value) || 0)
      : buildModbusReadFrame(1, unitId, Number(ctx.parameters.address) || 0, Number(ctx.parameters.quantity) || 1);
    const timeoutMs = Number(ctx.parameters.timeoutMs) || 3000;
    return new Promise<FlowItem[]>((resolve) => {
      const socket = new net.Socket();
      let settled = false;
      const finish = (json: Record<string, unknown>) => {
        if (settled) return;
        settled = true;
        try { socket.destroy(); } catch { /* noop */ }
        resolve([{ json }]);
      };
      socket.setTimeout(timeoutMs);
      socket.connect(port, host, () => socket.write(frame));
      socket.on("data", (chunk) => {
        try {
          if (isWrite) {
            finish({ ok: true, operation: "write", raw: chunk.toString("hex") });
          } else {
            const byteCount = chunk.readUInt8(8);
            const registers: number[] = [];
            for (let i = 0; i < byteCount; i += 2) {
              registers.push(chunk.readUInt16BE(9 + i));
            }
            finish({ ok: true, operation: "read", registers });
          }
        } catch (err) {
          finish({ ok: false, error: (err as Error).message, raw: chunk.toString("hex") });
        }
      });
      socket.on("timeout", () => finish({ ok: false, error: "timeout: بدون پاسخ از دستگاه Modbus" }));
      socket.on("error", (err) => finish({ ok: false, error: err.message }));
    });
  },
};

export const mqttTriggerNode: NodeDefinition = {
  type: "mqttTrigger",
  name: "MQTT Trigger",
  group: "trigger",
  category: "Triggers",
  icon: "📶",
  color: "#f59e0b",
  description: "شروع Workflow با دریافت پیام روی یک Topic از بروکر MQTT محلی",
  isTrigger: true,
  properties: [
    { name: "brokerUrl", label: "آدرس بروکر (mqtt://host:1883)", type: "string", required: true, default: "mqtt://127.0.0.1:1883" },
    { name: "topic", label: "Topic (پشتیبانی از +/#)", type: "string", required: true, default: "sensors/#" },
  ],
  execute: async (ctx) => ctx.items,
};

export const networkNodes: NodeDefinition[] = [
  httpRequestNode,
  graphqlNode,
  webSocketClientNode,
  tcpSocketNode,
  udpSocketNode,
  mqttClientNode,
  mqttTriggerNode,
  modbusNode,
];
