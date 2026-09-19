const assert = require('node:assert');
const fs = require('node:fs');

const profile = fs.readFileSync('frontend/pages/profile.html', 'utf8');
const launch = fs.readFileSync('frontend/pages/theia.html', 'utf8');
const theme = fs.readFileSync('frontend/styles/theme.css', 'utf8');
const theiaTheme = fs.readFileSync('theia/gv-extension/theme-module.js', 'utf8');
const theiaToggle = fs.readFileSync('theia/lib/frontend/gv-theme.js', 'utf8');

assert.ok(profile.indexOf('profile-page.css') < profile.lastIndexOf('theme.css'), 'profile theme overrides must load after page CSS');
assert.match(theme, /\.profile-page.*\.auth-tab/s, 'light theme must cover profile controls');
assert.match(theme, /\.profile-page \[data-theme-toggle\].*color:#17243a/, 'light profile theme toggle must remain visible');
assert.match(theme, /\.admin-nav.*\.nav-item:hover.*background:#dce9f6/s, 'light admin navigation hover must not turn black');
assert.match(theme, /\.side-nav a:hover.*!important/s, 'light public navigation hover must override the dark base style');
assert.match(theme, /\.admin-metrics.*\.admin-panel/s, 'light theme must cover management cards');
assert.match(launch, /gvTheme/, 'Theia launch page must pass the global theme to its separate origin');
assert.match(theiaTheme, /gvThe(?:me|Theme)/, 'Theia must consume the launch theme bridge');
assert.match(theiaTheme, /familyKey\(family\)/, 'Theia must retain the selected style separately for each family');
assert.match(theiaTheme, /selected\.endsWith\('light'\)/, 'Theia must determine the active family from the concrete mode');
assert.match(theiaTheme, /localStorage\.setItem\('gv-theme', family\)/, 'Theia must update the global dashboard theme key');
assert.match(theiaTheme, /themes\.setCurrentTheme/, 'Studio must apply an actually registered native workbench theme');
assert.doesNotMatch(theiaToggle, /detail:\s*light\s*\?\s*['"]light['"]/, 'Theia toggle must send a concrete workbench mode, not a bare light value');
console.log('light theme synchronization contract passed');
