// ============================================================================
// Modbus TCP Node – خواندن/نوشتن رجیسترها و کویل‌های دستگاه‌های صنعتی
// FC1/2/3/4/5/6/15/16 – پیاده‌سازی خام MBAP+PDU
// ============================================================================
import net from "node:net";
import type { INodeType, ExecuteContext, Item } from "../types";

const FC: Record<string, number> = { readCoils: 1, readDiscrete: 2, readHolding: 3, readInput: 4, writeCoil: 5, writeRegister: 6, writeCoils: 15, writeRegisters: 16 };

export class Modbus implements INodeType {
  description = {
    displayName: "Modbus TCP",
    name: "modbus",
    group: ["transform" as const],
    version: 1,
    description: "ارتباط با PLC/دستگاه‌های صنعتی از طریق Modbus TCP",
    icon: "fa:industry",
    defaults: { name: "Modbus", color: "#0f766e" },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      { displayName: "Host", name: "host", type: "string" as const, default: "192.168.1.10" },
      { displayName: "Port", name: "port", type: "number" as const, default: 502 },
      { displayName: "Unit ID", name: "unitId", type: "number" as const, default: 1 },
      { displayName: "Function", name: "function", type: "options" as const, default: "readHolding", options: Object.keys(FC).map((k) => ({ name: `${k} (FC${FC[k]})`, value: k })) },
      { displayName: "Address", name: "address", type: "number" as const, default: 0 },
      { displayName: "Quantity", name: "quantity", type: "number" as const, default: 2 },
      { displayName: "Values (JSON array for write)", name: "values", type: "json" as const, default: "[0]" },
      { displayName: "Data Type", name: "dataType", type: "options" as const, default: "uint16", options: [{ name: "UInt16", value: "uint16" }, { name: "Int16", value: "int16" }, { name: "Float32 (2 regs, big-endian)", value: "float32" }, { name: "UInt32 (2 regs)", value: "uint32" }] },
      { displayName: "Timeout (ms)", name: "timeout", type: "number" as const, default: 5000 },
    ],
  };

  async execute(this: ExecuteContext): Promise<Item[][]> {
    const items = this.getInputData();
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const host = String(this.getNodeParameter("host", i, "")); const port = Number(this.getNodeParameter("port", i, 502));
      const unit = Number(this.getNodeParameter("unitId", i, 1)); const fname = String(this.getNodeParameter("function", i, "readHolding")); const fc = FC[fname];
      const addr = Number(this.getNodeParameter("address", i, 0)); const qty = Number(this.getNodeParameter("quantity", i, 1));
      const valsRaw = this.getNodeParameter("values", i, "[0]"); const vals: number[] = typeof valsRaw === "string" ? JSON.parse(valsRaw) : (valsRaw as number[]);
      const dtype = String(this.getNodeParameter("dataType", i, "uint16")); const timeout = Number(this.getNodeParameter("timeout", i, 5000));

      // ساخت PDU
      let pdu: Buffer;
      if (fc <= 4) { pdu = Buffer.alloc(5); pdu.writeUInt8(fc, 0); pdu.writeUInt16BE(addr, 1); pdu.writeUInt16BE(qty, 3); }
      else if (fc === 5) { pdu = Buffer.alloc(5); pdu.writeUInt8(fc, 0); pdu.writeUInt16BE(addr, 1); pdu.writeUInt16BE(vals[0] ? 0xff00 : 0, 3); }
      else if (fc === 6) { pdu = Buffer.alloc(5); pdu.writeUInt8(fc, 0); pdu.writeUInt16BE(addr, 1); pdu.writeUInt16BE(vals[0] & 0xffff, 3); }
      else if (fc === 15) { const bytes = Math.ceil(vals.length / 8); pdu = Buffer.alloc(6 + bytes); pdu.writeUInt8(fc, 0); pdu.writeUInt16BE(addr, 1); pdu.writeUInt16BE(vals.length, 3); pdu.writeUInt8(bytes, 5); vals.forEach((v, k) => { if (v) pdu[6 + (k >> 3)] |= 1 << (k & 7); }); }
      else { pdu = Buffer.alloc(6 + vals.length * 2); pdu.writeUInt8(fc, 0); pdu.writeUInt16BE(addr, 1); pdu.writeUInt16BE(vals.length, 3); pdu.writeUInt8(vals.length * 2, 5); vals.forEach((v, k) => pdu.writeUInt16BE(v & 0xffff, 6 + k * 2)); }
      const mbap = Buffer.alloc(7); mbap.writeUInt16BE(i + 1, 0); mbap.writeUInt16BE(0, 2); mbap.writeUInt16BE(pdu.length + 1, 4); mbap.writeUInt8(unit, 6);

      const resp = await new Promise<Buffer>((resolve, reject) => {
        const s = new net.Socket(); const t = setTimeout(() => { s.destroy(); reject(new Error("Modbus timeout")); }, timeout);
        s.connect(port, host, () => s.write(Buffer.concat([mbap, pdu])));
        s.on("data", (d) => { clearTimeout(t); s.end(); resolve(d); }); s.on("error", (e) => { clearTimeout(t); reject(e); });
      });
      const body = resp.subarray(7); const rfc = body.readUInt8(0);
      if (rfc & 0x80) throw new Error(`Modbus exception FC${rfc & 0x7f} code ${body.readUInt8(1)}`);
      let values: number[] = [];
      if (rfc <= 2) { const n = body.readUInt8(1); for (let b = 0; b < n; b++) for (let k = 0; k < 8; k++) values.push((body.readUInt8(2 + b) >> k) & 1); values = values.slice(0, qty); }
      else if (rfc <= 4) {
        const n = body.readUInt8(1) / 2; const regs: number[] = []; for (let k = 0; k < n; k++) regs.push(body.readUInt16BE(2 + k * 2));
        if (dtype === "int16") values = regs.map((r) => (r > 32767 ? r - 65536 : r));
        else if (dtype === "float32" || dtype === "uint32") { for (let k = 0; k + 1 < regs.length; k += 2) { const b = Buffer.alloc(4); b.writeUInt16BE(regs[k], 0); b.writeUInt16BE(regs[k + 1], 2); values.push(dtype === "float32" ? b.readFloatBE(0) : b.readUInt32BE(0)); } }
        else values = regs;
      } else values = [body.readUInt16BE(3)];
      out.push({ json: { host, unitId: unit, function: fname, address: addr, values } });
    }
    return [out];
  }
}
