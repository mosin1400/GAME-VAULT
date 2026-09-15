const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('server.js', 'utf8');
const studio = fs.readFileSync('theia/gv-extension/studio-module.js', 'utf8');

assert.match(server, /gvApiPort=\$\{encodeURIComponent\(PORT\)\}/, 'workspace launch URLs must carry the actual API port');
assert.match(studio, /gvApiPort/, 'Studio must read the API port from its launch URL');
console.log('Theia API port contract passed');
