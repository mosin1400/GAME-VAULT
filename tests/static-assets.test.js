const assert = require('node:assert/strict');
const { PAGE_ROUTES, LEGACY_ASSETS, contentTypeFor, resolveStaticPath } = require('../backend/http/static-assets');

assert.equal(PAGE_ROUTES['/'], 'frontend/pages/index.html');
assert.equal(PAGE_ROUTES['/manage.html'], 'frontend/pages/manage.html');
assert.equal(LEGACY_ASSETS['/app.js'], 'frontend/scripts/app.js');
assert.equal(LEGACY_ASSETS['/editor-page.css'], undefined);
assert.equal(LEGACY_ASSETS['/project-tools.js'], 'frontend/scripts/project-tools.js');
assert.equal(contentTypeFor('.css'), 'text/css; charset=utf-8');
assert.equal(contentTypeFor('.unknown'), 'application/octet-stream');
assert.equal(resolveStaticPath('/profile.html'), 'frontend/pages/profile.html');
assert.equal(resolveStaticPath('/frontend/styles/theme.css'), 'frontend/styles/theme.css');
assert.equal(resolveStaticPath('/server.js'), null);
console.log('static asset catalog passed');
