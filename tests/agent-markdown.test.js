const assert = require('node:assert/strict');
const { renderMarkdown } = require('../theia/gv-extension/markdown-renderer');

const html = renderMarkdown('# عنوان\n\n**مهم** و [لینک](https://example.com)\n\n| الف | ب |\n| --- | --- |\n| ۱ | ۲ |\n\n```js\nconst x = 1;\n```\n\n<script>alert(1)</script>');
assert.match(html, /<h1>عنوان<\/h1>/);
assert.match(html, /<strong>مهم<\/strong>/);
assert.match(html, /href="https:\/\/example\.com"/);
assert.match(html, /<table>/);
assert.match(html, /<pre><code class="language-js">/);
assert.doesNotMatch(html, /<script>/, 'untrusted AI markdown must not inject executable HTML');
console.log('agent markdown passed');
