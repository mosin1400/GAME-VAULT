// ============================================================================
// WebSocket Client/Server Node – ارتباط دوطرفه
// Client: ارسال پیام و دریافت پاسخ | Server (trigger): دریافت پیام از کلاینت‌ها
// ============================================================================
import http from "node:http";
import crypto from "node:crypto";
import type { INodeType, ExecuteContext, TriggerContext, Item } from "../types";

export class WebSocketNode implements INodeType {
  description = {
    displayName: "WebSocket Client/Server",
    name: "webSocketNode",
    group: ["transform" as const, "trigger" as const],
    version: 1,
    description: "ارسال/دریافت پیام WebSocket (کلاینت) یا میزبانی سرور WebSocket (تریگر)",
    icon: "fa:exchange-alt",
    defaults: { name: "WebSocket", color: "#0f766e" },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      { displayName: "Mode", name: "mode", type: "options" as const, default: "client", options: [{ name: "Client", value: "client" }, { name: "Server (trigger)", value: "server" }] },
      { displayName: "URL (client)", name: "url", type: "string" as const, default: "ws://localhost:8080" },
      { displayName: "Message", name: "message", type: "string" as const, default: "={{ JSON.stringify($json) }}" },
      { displayName: "Wait For Response", name: "waitForResponse", type: "boolean" as const, default: true },
      { displayName: "Timeout (ms)", name: "timeout", type: "number" as const, default: 5000 },
      { displayName: "Port (server)", name: "port", type: "number" as const, default: 8090 },
    ],
  };

  /** حالت کلاینت */
  async execute(this: ExecuteContext): Promise<Item[][]> {
    const items = this.getInputData();
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const url = String(this.getNodeParameter("url", i, "ws://localhost:8080"));
      const msg = String(this.getNodeParameter("message", i, ""));
      const wait = Boolean(this.getNodeParameter("waitForResponse", i, true));
      const timeout = Number(this.getNodeParameter("timeout", i, 5000));
      const r = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const ws = new WebSocket(url);
        const t = setTimeout(() => { ws.close(); resolve({ sent: true, timeout: true }); }, timeout);
        ws.onopen = () => { ws.send(msg); if (!wait) { clearTimeout(t); ws.close(); resolve({ sent: true }); } };
        ws.onmessage = (ev) => { clearTimeout(t); ws.close(); let data: unknown = String(ev.data); try { data = JSON.parse(String(ev.data)); } catch { /* raw */ } resolve({ sent: true, response: data }); };
        ws.onerror = () => { clearTimeout(t); reject(new Error(`WebSocket error connecting to ${url}`)); };
      });
      out.push({ json: r });
    }
    return [out];
  }

  /** حالت سرور: پیاده‌سازی RFC6455 حداقلی (بدون وابستگی) */
  async trigger(this: TriggerContext) {
    const port = Number(this.getNodeParameter("port", 0, 8090));
    const server = http.createServer((_req, res) => { res.writeHead(200); res.end("FlowForge WebSocket server"); });
    server.on("upgrade", (req, socket) => {
      const key = req.headers["sec-websocket-key"];
      if (!key) return socket.destroy();
      const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
      socket.on("data", (buf: Buffer) => {
        const opcode = buf[0] & 0x0f;
        if (opcode === 8) return socket.end();
        let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { len = Number(buf.readBigUInt64BE(2)); off = 10; }
        const mask = buf.subarray(off, off + 4); off += 4;
        const payload = Buffer.alloc(len);
        for (let i = 0; i < len; i++) payload[i] = buf[off + i] ^ mask[i % 4];
        const text = payload.toString("utf8");
        let data: unknown = text; try { data = JSON.parse(text); } catch { /* raw */ }
        this.emit([[{ json: { message: data, remote: req.socket.remoteAddress, receivedAt: new Date().toISOString() } }]]);
        // ack
        const ack = Buffer.from(JSON.stringify({ ok: true }));
        socket.write(Buffer.concat([Buffer.from([0x81, ack.length]), ack]));
      });
    });
    server.listen(port, () => this.logger.info(`WebSocket server listening on :${port}`));
    return { closeFunction: async () => new Promise<void>((r) => server.close(() => r())) };
  }
}
