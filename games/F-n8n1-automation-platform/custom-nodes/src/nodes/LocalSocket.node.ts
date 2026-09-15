// ============================================================================
// Local TCP/UDP Socket Node – اتصال به هر سوکت روی شبکه لوکال
// ============================================================================
import net from "node:net";
import dgram from "node:dgram";
import type { INodeType, ExecuteContext, Item } from "../types";

export class LocalSocket implements INodeType {
  description = {
    displayName: "Local TCP/UDP Socket",
    name: "localSocket",
    group: ["output" as const],
    version: 1,
    description: "ارسال/دریافت داده روی TCP یا UDP",
    icon: "fa:plug",
    defaults: { name: "TCP/UDP", color: "#0f766e" },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      { displayName: "Protocol", name: "protocol", type: "options" as const, default: "tcp", options: [{ name: "TCP", value: "tcp" }, { name: "UDP", value: "udp" }] },
      { displayName: "Host", name: "host", type: "string" as const, default: "127.0.0.1" },
      { displayName: "Port", name: "port", type: "number" as const, default: 9000 },
      { displayName: "Data", name: "data", type: "string" as const, default: "={{ JSON.stringify($json) }}" },
      { displayName: "Encoding", name: "encoding", type: "options" as const, default: "utf8", options: [{ name: "UTF-8", value: "utf8" }, { name: "Hex", value: "hex" }, { name: "Base64", value: "base64" }] },
      { displayName: "Wait For Response", name: "waitForResponse", type: "boolean" as const, default: true },
      { displayName: "Timeout (ms)", name: "timeout", type: "number" as const, default: 5000 },
    ],
  };

  async execute(this: ExecuteContext): Promise<Item[][]> {
    const items = this.getInputData();
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const protocol = String(this.getNodeParameter("protocol", i, "tcp"));
      const host = String(this.getNodeParameter("host", i, "127.0.0.1"));
      const port = Number(this.getNodeParameter("port", i, 9000));
      const enc = String(this.getNodeParameter("encoding", i, "utf8")) as BufferEncoding;
      const data = Buffer.from(String(this.getNodeParameter("data", i, "")), enc);
      const timeout = Number(this.getNodeParameter("timeout", i, 5000));
      if (protocol === "udp") {
        const sock = dgram.createSocket("udp4");
        await new Promise<void>((res, rej) => sock.send(data, port, host, (e) => { sock.close(); e ? rej(e) : res(); }));
        out.push({ json: { protocol, host, port, sent: data.length } });
        continue;
      }
      const wait = Boolean(this.getNodeParameter("waitForResponse", i, true));
      const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const s = new net.Socket(); const chunks: Buffer[] = [];
        const t = setTimeout(() => { s.destroy(); resolve({ protocol, host, port, sent: data.length, response: Buffer.concat(chunks).toString(enc), timeout: true }); }, timeout);
        s.connect(port, host, () => { s.write(data); if (!wait) { clearTimeout(t); s.end(); resolve({ protocol, host, port, sent: data.length }); } });
        s.on("data", (d) => { chunks.push(d); clearTimeout(t); s.end(); resolve({ protocol, host, port, sent: data.length, response: Buffer.concat(chunks).toString(enc) }); });
        s.on("error", (e) => { clearTimeout(t); reject(e); });
      });
      out.push({ json: result });
    }
    return [out];
  }
}
