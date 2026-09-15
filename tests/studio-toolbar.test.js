const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

(async () => {
  const elements = new Map(), requests = [], navigation = [], calls = [];
  function element(tag = 'div') {
    return { tag, dataset: {}, children: [], options: [], value: '',
      set innerHTML(value) { this.html = value; for (const match of value.matchAll(/<(button|select|span)[^>]*id="([^"]+)"/g)) elements.set(match[2], element(match[1])); },
      appendChild(child) { this.children.push(child); if (child.tag === 'option') { this.options.push(child); if (child.selected) this.value = child.value; } },
      querySelector(selector) { return elements.get(selector.slice(1)); },
      querySelectorAll() { return [...elements.values()].filter(item => ['select', 'button'].includes(item.tag)); }, closest() { return true; }
    };
  }
  const shell = { leftPanelHandler: { expand: () => calls.push('left+'), collapse: () => calls.push('left-') }, rightPanelHandler: { expand: () => calls.push('right+'), collapse: () => calls.push('right-') }, bottomPanel: { isHidden: true }, expandBottomPanel: () => calls.push('bottom+'), collapseBottomPanel: () => calls.push('bottom-'), activateWidget: id => calls.push(id) };
  const context = { module: { exports: {} }, URL, BroadcastChannel: class { postMessage() {} close() {} }, localStorage: { getItem: () => 'modern-light' },
    document: { getElementById: () => null, createElement: element, body: element() },
    window: { prompt: () => 'v3', confirm: () => true, location: { assign: url => navigation.push(url) }, open: url => navigation.push(url) }
  };
  vm.runInNewContext(fs.readFileSync('theia/gv-extension/studio-toolbar.js', 'utf8'), context);
  let failDelete = false;
  context.module.exports.mountStudioToolbar({ shell, project: () => ({ game: 'demo', version: 'v2' }), API: 'http://127.0.0.1:8081', apiFetch: async (url, options = {}) => {
    requests.push({ url, method: options.method, data: options.body ? JSON.parse(options.body) : null });
    const data = url.includes('/api/versions') ? { versions: [{ name: 'v1' }, { name: 'v2' }] } : url.includes('/api/theia/open') ? { url: `http://127.0.0.1:3010/?gvVersion=${JSON.parse(options.body).version}#${encodeURI('/C:/projects/demo/versions/' + JSON.parse(options.body).version)}` } : { error: 'Delete denied' };
    return { ok: !(failDelete && options.method === 'DELETE'), json: async () => data };
  } });
  const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(setImmediate); };
  await flush();
  assert.ok(!elements.has('gv-theme-mode')); assert.ok(!elements.has('gv-project-tools'));
  elements.get('gv-layout-bottom').onclick(); assert.equal(calls.at(-1), 'bottom+');
  elements.get('gv-layout-explorer').onclick(); assert.deepEqual(calls.slice(-2), ['left+', 'right-']);
  elements.get('gv-version').value = 'v1'; elements.get('gv-version').onchange(); await flush();
  const selected = new URL(navigation.at(-1));
  assert.equal(selected.hash, '#/C:/projects/demo/versions/v1'); assert.equal(selected.searchParams.get('gvTheme'), 'modern-light');
  failDelete = true; const count = navigation.length;
  elements.get('gv-version-delete').onclick(); await flush();
  assert.equal(navigation.length, count); assert.equal(elements.get('gv-toolbar-status').textContent, 'Delete denied');
  failDelete = false; elements.get('gv-version-delete').onclick(); await flush();
  assert.equal(requests.find(request => request.method === 'DELETE').data.version, 'v2');
  assert.equal(new URL(navigation.at(-1)).searchParams.get('gvVersion'), 'v1');
  console.log('Studio toolbar behavior passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
