const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'theia');
const source = fs.readFileSync(path.join(root, 'src-gen', 'frontend', 'index.js'), 'utf8');
const imports = [...source.matchAll(/require\('(@theia\/[^']+)/g)].map(match => match[1]);
const missing = [...new Set(imports.filter(request => {
  try { require.resolve(request, { paths: [root] }); return false; }
  catch { return true; }
}))];

assert.deepEqual(missing, [], 'every generated Theia frontend module must be installed before building');
console.log('Theia frontend dependency contract passed');
