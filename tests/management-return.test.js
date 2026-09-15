const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('frontend/scripts/manage.js', 'utf8');
const routeCode = source.slice(source.indexOf('function restoreManagementView'), source.indexOf('setInterval(init,5000)'));
const makeNode = (id, label) => ({ id, dataset: { view: id }, textContent: label, classes: {}, classList: { toggle(name, value) { this.owner.classes[name] = value; } } });
const views = ['managementDashboard', 'managementGames', 'communityAdmin'].map(id => makeNode(id, id));
views.forEach(node => node.classList.owner = node);
const title = {};
const location = { hash: '#communityAdmin', pathname: '/manage.html', search: '', href: 'http://localhost:8081/manage.html#communityAdmin' };
let onClick;
vm.runInNewContext(routeCode, { URL, location, $: () => title,
  history: { replaceState(a, b, hash) { location.hash = hash; } },
  window: { addEventListener() {} }, document: {
    querySelectorAll: () => views,
    addEventListener(type, fn) { onClick = fn; },
  },
});
assert.equal(title.textContent, 'communityAdmin');
assert.equal(views[2].classes.hidden, false);
assert.equal(views[0].classes.hidden, true);
const link = { href: 'http://localhost:8081/profile.html' };
onClick({ target: { closest: selector => selector === 'a[href]' ? link : null } });
assert.equal(link.href, '/profile.html?returnTo=%2Fmanage.html%23communityAdmin');
onClick({ target: { closest: selector => selector === '[data-view]' ? views[1] : null } });
assert.equal(location.hash, '#managementGames');
console.log('Management restores the selected section after Profile navigation');
