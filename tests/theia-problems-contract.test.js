const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'theia', 'gv-extension', 'problems-module.js');
const frontend = fs.readFileSync(path.join(root, 'theia', 'src-gen', 'frontend', 'index.js'), 'utf8');

assert.ok(fs.existsSync(source), 'Theia must include a native Problems provider');
const problems = fs.readFileSync(source, 'utf8');
assert.match(problems, /problemManager\.setMarkers/, 'diagnostics must feed the real Theia Problems service');
assert.match(problems, /monaco\.editor\.onDidCreateModel/, 'opened editors must receive live diagnostics');
for (const validator of ['validateJson', 'validateHtml', 'validateCss', 'validateJavaScript']) {
  assert.match(problems, new RegExp(`function ${validator}`), `${validator} must provide real syntax diagnostics`);
}
assert.match(frontend, /problems-module/, 'native Problems provider must be loaded by Theia');
console.log('Theia Problems contract passed');
