const assert = require('node:assert/strict');
const fs = require('node:fs');
const { describeAgentActivity } = require('../theia/gv-extension/codex-activity');

assert.match(
  fs.readFileSync('theia/gv-extension/studio-module.js', 'utf8'),
  /fonts\.googleapis\.com\/css2\?family=Vazirmatn/,
  'the native Agent must load Vazirmatn instead of silently falling back to Arial',
);

assert.deepEqual(
  describeAgentActivity({ type: 'read_file', detail: 'src/main.js' }),
  { heading: 'Thinking', detail: 'Reading src/main.js' },
  'file reads must be shown as observable thinking activity',
);
assert.deepEqual(
  describeAgentActivity({ type: 'search_text', detail: 'renderGame' }),
  { heading: 'Thinking', detail: 'Searching for renderGame' },
  'searches must explain the observable operation in English',
);
assert.deepEqual(
  describeAgentActivity({ type: 'propose_terminal_command' }),
  { heading: 'Thinking', detail: 'Preparing a command proposal' },
  'a proposed command must never be represented as already run',
);
assert.deepEqual(
  describeAgentActivity({ type: 'unknown_tool' }),
  { heading: 'Thinking', detail: 'Using project tools' },
  'unknown tool events must not leak raw internal tool names',
);
assert.deepEqual(
  describeAgentActivity({ type: 'action', action: { type: 'write', path: 'src/main.js', diff: '@@\n-old\n+new' } }),
  { heading: 'Proposed edit to 1 file +1 -1', detail: 'src/main.js' },
  'write proposals must expose an English file and diff summary',
);
assert.deepEqual(
  describeAgentActivity({ type: 'action', action: { type: 'delete', path: 'old.js', diff: '@@\n-old' } }),
  { heading: 'Proposed deletion of 1 file +0 -1', detail: 'old.js' },
  'deletes must be visibly different from edits',
);
console.log('Codex activity presentation passed');
