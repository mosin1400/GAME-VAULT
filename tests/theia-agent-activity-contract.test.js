const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('server.js', 'utf8');
const cors = fs.readFileSync('backend/http/theia-cors.js', 'utf8');
const theiaIndex = fs.readFileSync('theia/lib/frontend/index.html', 'utf8');
const manage = fs.readFileSync('frontend/scripts/manage.js', 'utf8');

assert.doesNotMatch(theiaIndex, /gv-agent\.js/, 'Theia must not ship the retired overlay Agent');
assert.ok(fs.existsSync('theia/gv-extension/studio-module.js'), 'Theia native Agent contribution must exist');
assert.match(fs.readFileSync('theia/src-gen/frontend/index.js', 'utf8'), /gv-extension\/studio-module/, 'Theia native Agent must be loaded into the workbench');
assert.ok(fs.existsSync('theia/gv-extension/theme-module.js'), 'Theia must use its preference service for real light and dark themes');
assert.match(fs.readFileSync('theia/src-gen/frontend/index.js', 'utf8'), /gv-extension\/theme-module/, 'Theia theme bridge must be loaded into the workbench');
assert.match(server, /applyTheiaCors/, 'server must apply the isolated Theia CORS policy');
assert.match(server, /createAgentMemory/, 'server must persist Studio Agent conversations');
assert.match(server, /buildAgentContext/, 'server must send project context to the Studio Agent');
assert.match(server, /\/api\/agent\/conversation/, 'server must expose persisted Agent conversation history');
assert.match(server, /\/api\/agent\/message/, 'server must expose the contextual Agent endpoint');
assert.match(cors, /Access-Control-Allow-Origin/, 'Theia must be permitted to call the local Game Vault API');
assert.match(manage, /api\('\/api\/activity\/weekly'\)/, 'management dashboard must load actual weekly activity');
assert.doesNotMatch(manage, /\[38,60,44,80,56,94,71,87,64,100\]/, 'management dashboard must not show a synthetic activity chart');
console.log('Theia agent and real activity contract passed');
