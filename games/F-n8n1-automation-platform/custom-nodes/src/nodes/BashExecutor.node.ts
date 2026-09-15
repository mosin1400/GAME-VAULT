// ============================================================================
// Bash Script Executor – اجرای اسکریپت Bash با stdout/stderr/exitCode
// ============================================================================
import { spawn } from "node:child_process";
import type { INodeType, ExecuteContext, Item } from "../types";

export class BashExecutor implements INodeType {
  description = {
    displayName: "Bash Script Executor",
    name: "bashExecutor",
    group: ["transform" as const],
    version: 1,
    description: "اجرای اسکریپت Bash و بازگرداندن خروجی",
    icon: "fa:terminal",
    defaults: { name: "Bash", color: "#111827" },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      { displayName: "Script", name: "script", type: "string" as const, default: "echo hello", typeOptions: { rows: 8 } },
      { displayName: "Working Directory", name: "cwd", type: "string" as const, default: "/tmp" },
      { displayName: "Env (JSON)", name: "env", type: "json" as const, default: "{}" },
      { displayName: "Stdin (from item)", name: "stdin", type: "string" as const, default: "" },
      { displayName: "Timeout (ms)", name: "timeout", type: "number" as const, default: 30000 },
      { displayName: "Parse stdout as JSON", name: "parseJson", type: "boolean" as const, default: false },
    ],
  };

  async execute(this: ExecuteContext): Promise<Item[][]> {
    const items = this.getInputData();
    const out: Item[] = [];
    for (let i = 0; i < Math.max(items.length, 1); i++) {
      const script = String(this.getNodeParameter("script", i, ""));
      const cwd = String(this.getNodeParameter("cwd", i, "/tmp"));
      const envRaw = this.getNodeParameter("env", i, "{}");
      const env = { ...process.env, ...(typeof envRaw === "string" ? JSON.parse(envRaw || "{}") : envRaw) };
      const stdin = String(this.getNodeParameter("stdin", i, ""));
      const timeout = Number(this.getNodeParameter("timeout", i, 30000));
      const parse = Boolean(this.getNodeParameter("parseJson", i, false));
      const r = await new Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }>((resolve) => {
        const child = spawn("bash", ["-c", script], { cwd, env });
        let stdout = "", stderr = "", timedOut = false;
        const t = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeout);
        child.stdout.on("data", (d) => (stdout += d));
        child.stderr.on("data", (d) => (stderr += d));
        child.on("close", (code) => { clearTimeout(t); resolve({ stdout, stderr, exitCode: code ?? -1, timedOut }); });
        if (stdin) child.stdin.write(stdin);
        child.stdin.end();
      });
      let parsed: unknown = undefined;
      if (parse) { try { parsed = JSON.parse(r.stdout); } catch { /* ignore */ } }
      out.push({ json: { ...r, ...(parsed !== undefined ? { data: parsed } : {}) } });
    }
    return [out];
  }
}
