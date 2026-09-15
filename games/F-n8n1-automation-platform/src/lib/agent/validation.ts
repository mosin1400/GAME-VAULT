import type { NodeDef } from "../nodes/catalog";
import type { WorkflowNode, WorkflowEdge } from "../../db/schema";
export type Draft = { name: string; nodes: WorkflowNode[]; edges: WorkflowEdge[]; explanation: string; requirements: string[] };
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);

export function validateDraft(value: unknown, catalog: NodeDef[], credentialIds: number[] = []): { draft?: Draft; errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  if (!record(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return { errors: ["nodes و edges باید آرایه باشند"], warnings };
  if (!value.nodes.length || value.nodes.length > 60 || value.edges.length > 120) return { errors: ["جریان باید ۱ تا ۶۰ نود و حداکثر ۱۲۰ اتصال داشته باشد"], warnings };
  const map = new Map(catalog.map((d) => [d.type, d]));
  const ids = new Set<string>(), names = new Set<string>();
  const nodes: WorkflowNode[] = [];
  for (const raw of value.nodes) {
    if (!record(raw) || typeof raw.id !== "string" || typeof raw.type !== "string") { errors.push("هر نود باید id و type داشته باشد"); continue; }
    const def = map.get(raw.type);
    if (!def) { errors.push(`ابزار موجود نیست: ${raw.type}`); continue; }
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(raw.id) || ids.has(raw.id)) errors.push(`شناسه نامعتبر یا تکراری: ${raw.id}`);
    ids.add(raw.id);
    const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 160) : `${def.name} ${nodes.length + 1}`;
    if (names.has(name)) errors.push(`نام تکراری نود: ${name}`);
    names.add(name);
    const params = record(raw.parameters) ? raw.parameters : {};
    const defaults: Record<string, unknown> = {};
    for (const p of def.params) if (p.default !== undefined) defaults[p.name] = p.default;
    for (const [key, v] of Object.entries(params)) {
      const p = def.params.find((p) => p.name === key);
      if (!p) { errors.push(`${raw.id}: پارامتر ناشناخته ${key}`); continue; }
      const expression = typeof v === "string" && v.includes("{{");
      if (!expression && p.type === "select" && p.options && !p.options.some((o) => o.value === v)) errors.push(`${raw.id}: مقدار نامعتبر ${key}`);
      if (!expression && p.type === "number" && (typeof v !== "number" || !Number.isFinite(v))) errors.push(`${raw.id}: ${key} باید عدد باشد`);
      if (!expression && p.type === "boolean" && typeof v !== "boolean") errors.push(`${raw.id}: ${key} باید boolean باشد`);
      if (["string", "code", "textarea"].includes(p.type) && typeof v !== "string") errors.push(`${raw.id}: ${key} باید متن باشد`);
      if (p.type === "json" && typeof v === "string" && !expression) {
        try { JSON.parse(v); } catch { errors.push(`${raw.id}: JSON پارامتر ${key} نامعتبر است`); }
      }
      if (/token|password|secret|apiKey|authToken/i.test(key) && v) errors.push(`${raw.id}: اطلاعات حساس باید در Credential باشند`);
      if (typeof v === "string" && /(?:api[_-]?key|access[_-]?token|password)=/i.test(v)) errors.push(`${raw.id}: مقدار دارای اطلاعات حساس است`);
    }
    const parameters = { ...defaults, ...params };
    if (def.handler === "genericApi" && !parameters.endpoint && parameters.simulate !== true) errors.push(`${raw.id}: Integration عمومی به endpoint واقعی نیاز دارد`);
    if (def.type === "httpRequest" && !parameters.url) errors.push(`${raw.id}: URL درخواست لازم است`);
    if (def.handler === "noop") errors.push(`${raw.id}: ابزار پیاده‌سازی اجرایی ندارد`);
    if (raw.credentialId != null && (typeof raw.credentialId !== "number" || !credentialIds.includes(raw.credentialId))) errors.push(`${raw.id}: Credential موجود نیست`);
    if (def.credentialType && raw.credentialId == null) warnings.push(`${name}: Credential نوع ${def.credentialType} را تنظیم کنید`);
    if (parameters.simulate === true) warnings.push(`${name}: شبیه‌سازی فعال است`);
    if (["bash", "pythonCode", "code", "postgres"].includes(def.type)) warnings.push(`${name}: کد یا دستور را قبل از اجرا بررسی کنید`);
    if (def.handler === 'customJs') warnings.push(`${name}: کد نود سفارشی نصب‌شده توسط مدیر اجرا می‌شود`);
    if (def.trigger && !["manualTrigger", "webhookTrigger", "scheduleTrigger", "pollingTrigger"].includes(def.type)) warnings.push(`${name}: دریافت رویداد تریگر باید جداگانه بررسی شود`);
    nodes.push({ id: raw.id, type: raw.type, name, parameters, position: { x: 80 + nodes.length * 260, y: 220 }, ...(typeof raw.credentialId === "number" ? { credentialId: raw.credentialId } : {}) });
  }
  const edges: WorkflowEdge[] = [], edgeIds = new Set<string>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const raw of value.edges) {
    if (!record(raw) || typeof raw.source !== "string" || typeof raw.target !== "string") { errors.push("اتصال نامعتبر است"); continue; }
    const source = byId.get(raw.source), target = byId.get(raw.target);
    if (!source || !target) { errors.push("اتصال به نود ناموجود"); continue; }
    const sourceDef = map.get(source.type)!, targetDef = map.get(target.type)!;
    const sourceHandle = typeof raw.sourceHandle === "string" ? raw.sourceHandle : "main";
    const targetHandle = typeof raw.targetHandle === "string" ? raw.targetHandle : "in0";
    if (!sourceDef.outputs.includes(sourceHandle)) errors.push(`${source.id}: شاخه ${sourceHandle} موجود نیست`);
    if (!/^in\d+$/.test(targetHandle) || Number(targetHandle.slice(2)) >= targetDef.inputs) errors.push(`${target.id}: ورودی ${targetHandle} موجود نیست`);
    const id = typeof raw.id === "string" ? raw.id : `e${edges.length + 1}`;
    if (edgeIds.has(id)) errors.push(`شناسه اتصال تکراری: ${id}`);
    edgeIds.add(id); edges.push({ id, source: source.id, target: target.id, sourceHandle, targetHandle });
  }
  const starts = nodes.filter((n) => map.get(n.type)?.trigger);
  if (!starts.length) errors.push("جریان به تریگر نیاز دارد");
  const reachable = new Set(starts.map((n) => n.id));
  for (let i = 0; i < nodes.length; i++) for (const e of edges) if (reachable.has(e.source)) reachable.add(e.target);
  for (const n of nodes) if (!reachable.has(n.id)) errors.push(`${n.id}: نود از تریگر قابل دسترسی نیست`);
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visiting.add(id);
    for (const e of edges.filter((e) => e.source === id)) {
      if (visiting.has(e.target)) { if (byId.get(e.target)?.type !== "loop") errors.push("چرخه فقط با loop مجاز است"); }
      else visit(e.target);
    }
    visiting.delete(id); visited.add(id);
  };
  for (const n of starts) visit(n.id);
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], ...(errors.length ? {} : { draft: { name: typeof value.name === "string" ? value.name.slice(0, 255) : "اتوماسیون جدید", nodes, edges, explanation: typeof value.explanation === "string" ? value.explanation.slice(0, 8000) : "", requirements: Array.isArray(value.requirements) ? value.requirements.filter((r): r is string => typeof r === "string").slice(0, 30) : [] } }) };
}
