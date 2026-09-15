import test from 'node:test';
import assert from 'node:assert/strict';
import { NODE_CATALOG } from '../src/lib/nodes/catalog.ts';
import { validateDraft } from '../src/lib/agent/validation.ts';
import { buildAutomation } from '../src/lib/agent/builder.ts';
import { readCodexResponse } from '../src/lib/engine/codex.ts';
import { validateNodeSpec, customNodeDefinition } from '../src/lib/agent/node-spec.ts';
import { executeCustomNode } from '../src/lib/engine/custom-node.ts';

const customSpec = () => ({ type: 'custom.multiply', name: 'ضرب', description: 'ضرب مقدار ورودی در ضریب', inputs: 1, outputs: ['main'], params: [{ name: 'factor', label: 'ضریب', type: 'number', default: 2 }], code: 'return {main: $items.map(item => ({json: {value: item.json.value * $params.factor}}))};' });
test('validates executable custom node metadata', () => {
  const result = validateNodeSpec(customSpec()); assert.deepEqual(result.errors, []);
  assert.equal(customNodeDefinition(result.spec).handler, 'customJs');
});
for (const [name, mutate] of [
  ['core type overwrite', s => s.type = 'httpRequest'],
  ['broken code', s => s.code = 'return { broken'],
  ['new listening trigger', s => s.inputs = 0],
  ['reserved param', s => s.params[0].name = 'constructor'],
  ['inline secret param', s => s.params[0].name = 'apiKey'],
  ['duplicate output', s => s.outputs = ['main', 'main']],
]) test(`rejects custom node ${name}`, () => { const s = customSpec(); mutate(s); assert.ok(validateNodeSpec(s).errors.length); });
test('agent returns code proposal without executing it', async () => {
  const responses = [{ action: 'search_tools', query: 'multiply' }, { action: 'create_node', spec: customSpec() }];
  const result = await buildAutomation({ prompt: 'make a multiplication node', catalog: NODE_CATALOG, credentials: [], allowNodeCreation: true, call: async () => JSON.stringify(responses.shift()) });
  assert.equal(result.status, 'node_draft'); assert.equal(result.spec.type, 'custom.multiply');
});
test('a non-admin agent cannot produce an installable node proposal', async () => {
  await assert.rejects(buildAutomation({ prompt: 'new node', catalog: NODE_CATALOG, credentials: [], call: async () => JSON.stringify({ action: 'create_node', spec: customSpec() }) }));
});
test('custom node worker executes parameterized code', async () => {
  const result = await executeCustomNode(customSpec(), { items: [{json: {value: 4}}], params: {factor: 3}, credential: {}, vars: {} });
  assert.deepEqual(result, {main: [{json: {value: 12}}]});
});
test('custom node worker rejects undeclared output handles', async () => {
  await assert.rejects(executeCustomNode({...customSpec(), code: 'return {fake: [{json: {}}]};'}, { items: [], params: {}, credential: {}, vars: {} }), /specification/);
});
test('custom node worker terminates infinite loops', async () => {
  await assert.rejects(executeCustomNode({...customSpec(), code: 'while(true) {}'}, { items: [], params: {}, credential: {}, vars: {} }, 500), /timeout/);
});

const draft = () => ({ name: 'HTTP automation', nodes: [
  { id: 'n1', type: 'manualTrigger', parameters: { payload: '{}' } },
  { id: 'n2', type: 'httpRequest', parameters: { url: 'https://example.org/data' } },
], edges: [{ source: 'n1', target: 'n2', sourceHandle: 'main', targetHandle: 'in0' }] });
test('accepts a real catalog workflow and adds defaults', () => {
  const result = validateDraft(draft(), NODE_CATALOG);
  assert.deepEqual(result.errors, []); assert.equal(result.draft.nodes.length, 2);
});
for (const [name, mutate] of [
  ['invented tool', d => d.nodes[1].type = 'inventedThing'],
  ['invented parameter', d => d.nodes[1].parameters.fakeOption = true],
  ['invented branch', d => d.edges[0].sourceHandle = 'made-up'],
  ['invalid input', d => d.edges[0].targetHandle = 'in9'],
  ['missing URL', d => d.nodes[1].parameters.url = ''],
  ['duplicate id', d => d.nodes[1].id = 'n1'],
  ['unknown credential', d => d.nodes[1].credentialId = 99],
  ['unreachable node', d => d.edges = []],
  ['non-loop cycle', d => d.edges.push({ source: 'n2', target: 'n2' })],
]) test(`rejects ${name}`, () => { const d = draft(); mutate(d); assert.ok(validateDraft(d, NODE_CATALOG).errors.length); });
test('rejects generic integration without real endpoint', () => {
  const d = draft(); d.nodes[1].type = NODE_CATALOG.find(n => n.handler === 'genericApi').type; d.nodes[1].parameters = {};
  assert.ok(validateDraft(d, NODE_CATALOG).errors.some(e => e.includes('endpoint')));
});
test('rejects malformed JSON parameter', () => {
  const d = draft(); d.nodes[1].parameters.body = '{broken';
  assert.ok(validateDraft(d, NODE_CATALOG).errors.some(e => e.includes('JSON')));
});
test('accepts If true and false branches from real catalog', () => {
  const d = draft(); d.nodes[1] = { id: 'n2', type: 'if', parameters: { condition: '={{ $json.ok === true }}' } };
  d.nodes.push({ id: 'yes', type: 'httpRequest', parameters: { url: 'https://example.org/yes' } }, { id: 'no', type: 'httpRequest', parameters: { url: 'https://example.org/no' } });
  d.edges.push({ source: 'n2', target: 'yes', sourceHandle: 'true' }, { source: 'n2', target: 'no', sourceHandle: 'false' });
  assert.deepEqual(validateDraft(d, NODE_CATALOG).errors, []);
});
test('supports Codex JSON Responses format', async () => {
  assert.equal(await readCodexResponse(Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: 'response' }] }] })), 'response');
});
test('agent inspects real tools and produces a validated draft', async () => {
  const outputs = [{ action: 'search_tools', query: 'http manual' }, { action: 'inspect_tools', types: ['manualTrigger', 'httpRequest'] }, { action: 'finish', draft: draft() }];
  const result = await buildAutomation({ prompt: 'fetch my endpoint', catalog: NODE_CATALOG, credentials: [], call: async () => JSON.stringify(outputs.shift()) });
  assert.equal(result.status, 'draft'); assert.equal(result.trace.length, 2);
});
test('agent repairs hallucinated graph instead of saving it', async () => {
  const invalid = draft(); invalid.nodes[1].type = 'inventedThing';
  const outputs = [{ action: 'finish', draft: invalid }, { action: 'inspect_tools', types: ['manualTrigger', 'httpRequest'] }, { action: 'finish', draft: draft() }];
  let feedback;
  const result = await buildAutomation({ prompt: 'fetch', catalog: NODE_CATALOG, credentials: [], call: async messages => { feedback = messages; return JSON.stringify(outputs.shift()); } });
  assert.equal(result.status, 'draft'); assert.ok(result.trace.some(t => t.action === 'repair'));
  assert.ok(feedback.some(m => m.content.includes('validationErrors')));
});
test('clarification does not produce or save a workflow', async () => {
  const result = await buildAutomation({ prompt: 'send a message', catalog: NODE_CATALOG, credentials: [], call: async () => JSON.stringify({ action: 'clarify', message: 'مقصد لازم است', questions: ['به چه کسی؟'] }) });
  assert.equal(result.status, 'clarification'); assert.equal(result.nodes, undefined);
});
test('bounds agent requests and rejects unproductive loops', async () => {
  let calls = 0;
  await assert.rejects(buildAutomation({ prompt: 'fetch', catalog: NODE_CATALOG, credentials: [], call: async () => { calls++; return '{}'; } }));
  assert.equal(calls, 10);
});
test('SSE handles fragmented UTF-8 and requires completion', async () => {
  const payload = 'data: {"type":"response.output_text.delta","delta":"سلام"}\r\n\r\ndata: {"type":"response.completed","response":{"status":"completed"}}\r\n\r\n';
  const bytes = new TextEncoder().encode(payload);
  const body = new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close(); } });
  assert.equal(await readCodexResponse(new Response(body, { headers: { 'content-type': 'text/event-stream' } })), 'سلام');
});
test('rejects interrupted or failed streams and hides provider error body', async () => {
  const response = payload => new Response(payload, { headers: { 'content-type': 'text/event-stream' } });
  await assert.rejects(readCodexResponse(response('data: {"type":"response.output_text.delta","delta":"partial"}\n\n')));
  await assert.rejects(readCodexResponse(response('data: {"type":"response.failed"}\n\n')));
  await assert.rejects(readCodexResponse(new Response('secret provider data', { status: 401 })), e => !e.message.includes('secret'));
});
