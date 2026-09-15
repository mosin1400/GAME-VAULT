const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function element() {
  return {
    children: [], attributes: {}, dataset: {}, hidden: false,
    appendChild(child) { this.children.push(child); },
    setAttribute(name, value) { this.attributes[name] = value; },
    contains(target) { return target === this || this.children.includes(target); }
  };
}
const toggle = element(), body = element(), events = [], storage = new Map();
vm.runInNewContext(fs.readFileSync('theia/lib/frontend/gv-theme.js', 'utf8'), {
  document: { querySelector: () => toggle, createElement: element, body, addEventListener() {} },
  localStorage: { setItem: (key, value) => storage.set(key, value) },
  window: { dispatchEvent: event => events.push(event), addEventListener() {} },
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
});
const menu = body.children[0];
assert.equal(menu.hidden, true);
toggle.onclick();
assert.equal(menu.hidden, false, 'clicking Themes must open the picker');
assert.equal(menu.children.length, 4);
menu.children[0].onclick();
assert.equal(events.at(-1).type, 'gv-theme-change');
assert.equal(events.at(-1).detail, 'modern-light', 'choosing Light must request the concrete light mode');
assert.equal(storage.get('gv-theia-theme-mode'), 'modern-light');
assert.equal(menu.hidden, true);
toggle.onclick();
assert.equal(menu.hidden, false);
menu.children[1].onclick();
assert.equal(events.at(-1).detail, 'modern-dark');
console.log('Studio theme picker click behavior passed');
