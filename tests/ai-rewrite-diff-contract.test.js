const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('server.js', 'utf8');
const studio = fs.readFileSync('theia/gv-extension/studio-module.js', 'utf8');

assert.match(server, /function createUnifiedDiff/, 'AI rewrite must create an actual before/after diff');
assert.match(server, /diff:\s*createUnifiedDiff/, 'each AI proposal file must return its diff before approval');
assert.match(server, /before\s*=\s*await projectSnapshot/, 'a snapshot must be created immediately before applying AI changes');
assert.match(studio, /\/api\/ai\/rewrite/, 'Studio must request an AI rewrite proposal');
assert.match(studio, /\/api\/ai\/rewrite\/apply/, 'Studio must explicitly apply only the accepted proposal');
assert.match(studio, /Snapshot/, 'Studio must explain the safe Snapshot confirmation');
console.log('AI rewrite diff contract passed');
