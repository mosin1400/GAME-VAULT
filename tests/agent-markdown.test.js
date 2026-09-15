const assert = require('node:assert/strict');
const { renderMarkdown } = require('../theia/gv-extension/markdown-renderer');

const html = renderMarkdown('# عنوان\n\n**مهم** و [لینک](https://example.com)\n\n| الف | ب |\n| --- | --- |\n| ۱ | ۲ |\n\n```js\nconst x = 1;\n```\n\n<script>alert(1)</script>');
assert.match(html, /<h1>عنوان<\/h1>/);
assert.match(html, /<strong>مهم<\/strong>/);
assert.match(html, /href="https:\/\/example\.com"/);
assert.match(html, /<table>/);
assert.match(html, /<pre><code class="language-js">/);
assert.doesNotMatch(html, /<script>/, 'untrusted AI markdown must not inject executable HTML');
const rich = renderMarkdown('###### Small\n\n- **Bold**\n  - nested\n\n~~deleted~~\n\n---\n\n[unsafe](javascript:alert(1))');
assert.match(rich, /<h6>Small<\/h6>/); assert.match(rich, /<s>deleted<\/s>/); assert.match(rich, /<ul>/); assert.match(rich, /<hr>/);
assert.doesNotMatch(rich, /href="javascript:/);
console.log('agent markdown passed');
