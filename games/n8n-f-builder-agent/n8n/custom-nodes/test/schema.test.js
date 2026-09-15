/**
 * تست واحد اعتبارسنج نود WorkflowBuilder
 * اجرا: npm run build && npm test
 */
const test = require("node:test");
const assert = require("node:assert");
const { validateAndNormalize, extractJson } = require("../dist/nodes/WorkflowBuilder/schema.js");

test("extracts JSON from markdown fence", () => {
  const out = extractJson('```json\n{"a":1}\n```');
  assert.deepStrictEqual(out, { a: 1 });
});

test("valid bale→codex workflow passes", () => {
  const wf = {
    name: "t",
    nodes: [
      { name: "Bale Trigger", type: "n8n-nodes-bale.baleTrigger", typeVersion: 1, parameters: {} },
      { name: "AI Agent", type: "@n8n/n8n-nodes-langchain.agent", typeVersion: 1.7, parameters: {} },
      { name: "Codex Chat Model", type: "@chrishdx/n8n-nodes-codex-cli-lm.codexCliLm", typeVersion: 1, parameters: {} },
    ],
    connections: {
      "Bale Trigger": { main: [[{ node: "AI Agent", type: "main", index: 0 }]] },
      "Codex Chat Model": { ai_languageModel: [[{ node: "AI Agent", type: "ai_languageModel", index: 0 }]] },
    },
  };
  const r = validateAndNormalize(wf);
  assert.strictEqual(r.valid, true, r.errors.join(","));
  assert.ok(r.workflow.nodes[0].webhookId, "webhookId auto-assigned");
});

test("missing trigger fails", () => {
  const r = validateAndNormalize({ name: "x", nodes: [{ name: "A", type: "n8n-nodes-base.set", typeVersion: 3.4 }], connections: {} });
  assert.strictEqual(r.valid, false);
});
