const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('frontend/pages/index.html', 'utf8');
const js = fs.readFileSync('frontend/scripts/app.js', 'utf8');

assert.match(html, /id="dashboardView"/, 'dashboard view must be present');
assert.match(html, /id="gamesView"/, 'games list view must be present');
assert.match(html, /id="detailView"/, 'game detail view must be present');
assert.match(js, /function navigateTo\(/, 'navigation function must switch views');
assert.match(js, /renderGameDetail\(/, 'game card must open a detail view');
assert.match(js, /loadProfile\(\)/, 'public shell must refresh the shared profile');
assert.match(js, /gamesRequestId/, 'stale game list responses must not overwrite newer data');
console.log('navigation views contract passed');
