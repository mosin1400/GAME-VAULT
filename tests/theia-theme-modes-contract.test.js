const assert = require('node:assert/strict');
const fs = require('node:fs');

const theme = fs.readFileSync('theia/gv-extension/theme-module.js', 'utf8');
const studio = fs.readFileSync('theia/gv-extension/studio-module.js', 'utf8');

for (const mode of ['main-dark', 'main-light', 'modern-dark', 'modern-light']) assert.match(theme, new RegExp(mode), `${mode} must be a persistent Studio theme mode`);
assert.match(theme, /workbench\.colorTheme/, 'theme modes must use real Theia workbench themes');
assert.match(theme, /gv-theia-theme-mode/, 'theme selection must persist locally');
assert.match(studio, /gv-theme-mode/, 'Studio toolbar must expose the theme selector');
console.log('Theia theme modes contract passed');
