import { fork } from 'node:child_process';
import path from 'node:path';
import type { CustomNodeSpec } from '../agent/node-spec';

export async function executeCustomNode(spec: CustomNodeSpec, input: { items: unknown[]; params: Record<string, unknown>; credential: Record<string, string>; vars: Record<string, string> }, timeoutMs = 15000): Promise<Record<string, { json: Record<string, unknown> }[]>> {
  if (JSON.stringify(input).length > 1000000) throw new Error('Custom node input exceeds 1 MB');
  return new Promise((resolve, reject) => {
    const child = fork(path.join(process.cwd(), 'scripts', 'custom-node-worker.mjs'), [], { execArgv: [], env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    let settled = false;
    const finish = (error?: Error, output?: Record<string, { json: Record<string, unknown> }[]>) => {
      if (settled) return; settled = true; clearTimeout(timer); child.kill();
      if (error) reject(error); else resolve(output!);
    };
    const timer = setTimeout(() => finish(new Error('Custom node timeout')), Math.min(30000, Math.max(100, timeoutMs)));
    child.once('error', () => finish(new Error('Custom node worker failed')));
    child.once('exit', () => finish(new Error('Custom node worker exited before response')));
    child.once('message', (message: unknown) => {
      const result = message as { ok: boolean; output: Record<string, unknown> };
      if (!result?.ok || !result.output || typeof result.output !== 'object' || Array.isArray(result.output)) return finish(new Error('Custom node must return an output-handle object'));
      if (JSON.stringify(result.output).length > 1000000) return finish(new Error('Custom node output exceeds 1 MB'));
      for (const [handle, items] of Object.entries(result.output)) {
        if (!spec.outputs.includes(handle) || !Array.isArray(items) || items.length > 1000 || items.some(i => !i || !i.json || typeof i.json !== 'object' || Array.isArray(i.json))) return finish(new Error('Custom node output does not match its specification'));
      }
      finish(undefined, result.output as Record<string, { json: Record<string, unknown> }[]>);
    });
    child.send({ code: spec.code, ...input }, error => { if (error) finish(new Error('Custom node input transfer failed')); });
  });
}
