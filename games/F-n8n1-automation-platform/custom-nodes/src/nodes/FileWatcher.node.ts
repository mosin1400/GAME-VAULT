// ============================================================================
// File System Watcher Trigger – مانیتورینگ تغییرات پوشه (add/change/unlink)
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import type { INodeType, TriggerContext } from "../types";

export class FileWatcher implements INodeType {
  description = {
    displayName: "File System Watcher",
    name: "fileWatcher",
    group: ["trigger" as const],
    version: 1,
    description: "شروع جریان با ایجاد/تغییر/حذف فایل",
    icon: "fa:eye",
    defaults: { name: "File Watcher", color: "#8b5cf6" },
    inputs: [],
    outputs: ["main"],
    properties: [
      { displayName: "Path", name: "path", type: "string" as const, default: "/files/inbox" },
      { displayName: "Recursive", name: "recursive", type: "boolean" as const, default: true },
      { displayName: "Pattern (glob-like, * and ?)", name: "pattern", type: "string" as const, default: "*" },
      { displayName: "Events", name: "events", type: "options" as const, default: "all", options: [{ name: "All", value: "all" }, { name: "Add", value: "add" }, { name: "Change", value: "change" }, { name: "Unlink", value: "unlink" }] },
      { displayName: "Debounce (ms)", name: "debounce", type: "number" as const, default: 300 },
    ],
  };

  async trigger(this: TriggerContext) {
    const dir = String(this.getNodeParameter("path", 0, "/files/inbox"));
    const recursive = Boolean(this.getNodeParameter("recursive", 0, true));
    const pattern = String(this.getNodeParameter("pattern", 0, "*"));
    const want = String(this.getNodeParameter("events", 0, "all"));
    const debounce = Number(this.getNodeParameter("debounce", 0, 300));
    const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
    fs.mkdirSync(dir, { recursive: true });
    const known = new Set(fs.readdirSync(dir));
    const timers = new Map<string, NodeJS.Timeout>();
    const watcher = fs.watch(dir, { recursive }, (_evt, filename) => {
      if (!filename) return;
      const name = filename.toString();
      if (!re.test(path.basename(name))) return;
      clearTimeout(timers.get(name));
      timers.set(name, setTimeout(() => {
        const full = path.join(dir, name);
        const exists = fs.existsSync(full);
        const event = !exists ? "unlink" : known.has(name) ? "change" : "add";
        if (exists) known.add(name); else known.delete(name);
        if (want !== "all" && want !== event) return;
        const stat = exists ? fs.statSync(full) : null;
        this.emit([[{ json: { event, path: full, name, size: stat?.size ?? null, mtime: stat?.mtime?.toISOString() ?? null, isDirectory: stat?.isDirectory() ?? false } }]]);
      }, debounce));
    });
    return { closeFunction: async () => watcher.close() };
  }
}
