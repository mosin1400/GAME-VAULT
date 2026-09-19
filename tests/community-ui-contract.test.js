const assert = require('node:assert/strict');
const fs = require('node:fs');

const publicUi = fs.readFileSync('frontend/scripts/community-ui.js', 'utf8');
const adminUi = fs.readFileSync('frontend/scripts/community-admin.js', 'utf8');
const publicCss = fs.readFileSync('frontend/styles/community.css', 'utf8');
const adminCss = fs.readFileSync('frontend/styles/manage-page.css', 'utf8');

assert.match(publicUi, /comment-avatar/, 'public comments need an author avatar');
assert.match(publicCss, /comment-body/, 'public comments need a bounded message body');
assert.match(adminUi, /admin-game-card/, 'admin comments need game context');
assert.match(adminCss, /overflow-wrap:anywhere/, 'admin comments must wrap unbroken text');
console.log('community UI contract passed');
