import type { NodeDef, ParamDef } from "../nodes/catalog";

export type CustomNodeSpec = { type: string; name: string; description: string; inputs: number; outputs: string[]; params: ParamDef[]; code: string; credentialType?: string };
const reserved = new Set(['__proto__', 'prototype', 'constructor']);

export function validateNodeSpec(raw: unknown): { spec?: CustomNodeSpec; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { errors: ['مشخصات نود باید object باشد'] };
  const v = raw as Record<string, unknown>;
  if (typeof v.type !== 'string' || !/^custom\.[a-z][a-z0-9_]{1,60}$/.test(v.type)) errors.push('type باید مانند custom.my_node باشد');
  if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 160) errors.push('نام نود لازم است؛ حداکثر ۱۶۰ کاراکتر');
  if (typeof v.description !== 'string' || v.description.length > 2000) errors.push('توضیح نود لازم است');
  if (![1, 2].includes(v.inputs as number)) errors.push('inputs باید ۱ یا ۲ باشد؛ تولید تریگر جدید پشتیبانی نمی‌شود');
  const outputs = Array.isArray(v.outputs) ? v.outputs : [];
  if (!outputs.length || outputs.length > 6 || new Set(outputs).size !== outputs.length || outputs.some(o => typeof o !== 'string' || !/^[a-z][a-z0-9_]{0,30}$/.test(o) || reserved.has(o))) errors.push('نام شاخه‌های خروجی نامعتبر یا تکراری است');
  const params = Array.isArray(v.params) ? v.params : [];
  if (!Array.isArray(v.params) || params.length > 30) errors.push('params باید آرایه با حداکثر ۳۰ پارامتر باشد');
  const names = new Set<string>();
  for (const rawParam of params) {
    if (!rawParam || typeof rawParam !== 'object' || Array.isArray(rawParam)) { errors.push('پارامتر نامعتبر'); continue; }
    const p = rawParam as Record<string, unknown>;
    if (typeof p.name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]{0,50}$/.test(p.name) || reserved.has(p.name) || names.has(p.name)) errors.push('نام پارامتر نامعتبر یا تکراری');
    names.add(String(p.name));
    if (typeof p.label !== 'string' || !p.label.trim() || p.label.length > 160) errors.push('label پارامتر لازم است');
    if (!['string', 'number', 'boolean', 'select', 'json', 'textarea'].includes(String(p.type))) errors.push('نوع پارامتر مجاز نیست');
    if (/password|token|secret|apiKey/i.test(String(p.name))) errors.push('رازها باید در Credential باشند');
    if (p.type === 'select') {
      if (!Array.isArray(p.options) || !p.options.length || p.options.length > 30 || p.options.some(o => !o || typeof o.value !== 'string' || typeof o.label !== 'string')) errors.push('گزینه‌های select نامعتبر است');
      else if (p.default !== undefined && !p.options.some(o => o.value === p.default)) errors.push('default باید یکی از گزینه‌های select باشد');
    }
    if (p.default !== undefined) {
      if (p.type === 'number' && (typeof p.default !== 'number' || !Number.isFinite(p.default))) errors.push('default عددی نامعتبر');
      if (p.type === 'boolean' && typeof p.default !== 'boolean') errors.push('default boolean نامعتبر');
      if (['string', 'textarea'].includes(String(p.type)) && typeof p.default !== 'string') errors.push('default متنی نامعتبر');
    }
  }
  if (typeof v.code !== 'string' || !v.code.trim() || v.code.length > 40000) errors.push('کد JavaScript لازم است؛ حداکثر ۴۰۰۰۰ کاراکتر');
  else {
    try { const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor; new AsyncFunction('$items', '$params', '$credential', '$vars', v.code); }
    catch { errors.push('syntax کد JavaScript نامعتبر است'); }
  }
  if (v.credentialType !== undefined && (typeof v.credentialType !== 'string' || !/^[a-zA-Z0-9_.-]{1,64}$/.test(v.credentialType))) errors.push('نوع Credential نامعتبر');
  if (errors.length) return { errors: [...new Set(errors)] };
  // Whitelist metadata; never accept an agent-provided handler or file path.
  const cleanedParams = params.map(p => ({ name: p.name, label: p.label, type: p.type, ...(p.default !== undefined ? { default: p.default } : {}), ...(p.type === 'select' ? { options: p.options } : {}), ...(typeof p.description === 'string' ? { description: p.description.slice(0, 1000) } : {}) })) as ParamDef[];
  return { errors: [], spec: { type: v.type as string, name: v.name as string, description: v.description as string, inputs: v.inputs as number, outputs: outputs as string[], params: cleanedParams, code: v.code as string, ...(typeof v.credentialType === 'string' ? { credentialType: v.credentialType } : {}) } };
}

export function customNodeDefinition(spec: CustomNodeSpec): NodeDef {
  return { type: spec.type, name: spec.name, description: spec.description, category: 'code', icon: '🧬', color: '#a855f7', inputs: spec.inputs, outputs: spec.outputs, params: spec.params, handler: 'customJs', ...(spec.credentialType ? { credentialType: spec.credentialType } : {}), meta: { custom: true } };
}
