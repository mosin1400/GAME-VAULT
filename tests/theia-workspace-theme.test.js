const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('server.js', 'utf8');
const pages = ['index.html', 'manage.html', 'profile.html'];

assert.match(server, /gvGame=\$\{encodeURIComponent\(data\.game\)\}/, 'Theia must receive the game identity in its URL');
assert.match(server, /gvVersion=\$\{encodeURIComponent\(data\.version\)\}/, 'Theia must receive the version identity in its URL');
assert.match(server, /workspace=\$\{encodeURIComponent\(workspace\)\}/, 'Theia must receive its isolated version as a native workspace URI');
assert.match(server, /workspace\s*=\s*`file:\/\/\//, 'workspace must be expressed as a file URI');
for (const page of pages) {
  const html = fs.readFileSync(`frontend/pages/${page}`, 'utf8');
  assert.match(html, /theme-sync\.js/, `${page} must load the shared theme synchronizer`);
}
assert.ok(fs.existsSync('frontend/scripts/theme-sync.js'), 'shared theme synchronizer must exist');
assert.match(fs.readFileSync('theia/lib/frontend/index.html', 'utf8'), /gv-theme\.js/, 'Theia must expose a persistent theme toggle');
console.log('Theia workspace and global theme contract passed');
