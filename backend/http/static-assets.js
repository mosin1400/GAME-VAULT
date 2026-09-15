const path = require('node:path');
const { isWithin, isProtectedEnvironmentPath } = require('../core/protected-paths');

const PAGE_ROUTES = {
  '/': 'frontend/pages/index.html',
  '/index.html': 'frontend/pages/index.html',
  '/manage.html': 'frontend/pages/manage.html',
  '/profile.html': 'frontend/pages/profile.html',
  '/theia.html': 'frontend/pages/theia.html'
};

const LEGACY_ASSETS = {};
const SCRIPT_ASSETS = ['app.js', 'markdown.js', 'activity-tracker.js', 'build-manager.js', 'community-admin.js', 'community-ui.js', 'manage.js', 'profile.js', 'project-tools.js', 'theme-sync.js', 'ui-icons.js'];
const STYLE_ASSETS = ['app-page.css', 'community.css', 'foundation.css', 'manage-page.css', 'profile-page.css', 'theme.css'];
for (const file of SCRIPT_ASSETS) LEGACY_ASSETS['/' + file] = 'frontend/scripts/' + file;
for (const file of STYLE_ASSETS) LEGACY_ASSETS['/' + file] = 'frontend/styles/' + file;
LEGACY_ASSETS['/manifest.webmanifest'] = 'frontend/public/manifest.webmanifest';
LEGACY_ASSETS['/sw.js'] = 'frontend/public/sw.js';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};
Object.assign(CONTENT_TYPES, {
  '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.avif': 'image/avif', '.wasm': 'application/wasm', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json'
});

function resolveStaticPath(urlPath) {
  if (typeof urlPath !== 'string' || !urlPath.startsWith('/')) return null;
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  if (/[\\\x00-\x1f\x7f%:?#]/.test(decoded) || isProtectedEnvironmentPath(decoded)) return null;
  const segments = decoded.slice(1).split('/');
  if (decoded !== '/' && segments.some(s => !s || s.startsWith('.') || /[. ]$/.test(s))) return null;
  if (Object.hasOwn(PAGE_ROUTES, decoded)) return PAGE_ROUTES[decoded];
  if (Object.hasOwn(LEGACY_ASSETS, decoded)) return LEGACY_ASSETS[decoded];
  const relative = decoded.slice(1);
  if (Object.values(PAGE_ROUTES).includes(relative) || Object.values(LEGACY_ASSETS).includes(relative)) return relative;
  // Temporary compatibility boundary, replaced by immutable release manifests in P05/P06.
  if (relative === 'data/games.json') return relative;
  if (segments.length >= 5 && segments[0] === 'games' && segments[2] === 'versions') {
    if (segments.some(s => ['node_modules', 'backend', 'secrets', 'config'].includes(s.toLowerCase()))) return null;
    const name = segments.at(-1).toLowerCase();
    if (/^(package(?:-lock)?\.json|game\.json|readme(?:\..*)?|.*\.config\..*)$/.test(name)) return null;
    const extension = path.posix.extname(name);
    if (/^\.(html?|css|js|mjs|png|jpe?g|webp|gif|svg|ico|bmp|avif|woff2?|ttf|eot|mp3|wav|ogg|mp4|webm|glb|gltf|fbx|bin|wasm|obj|mtl)$/.test(extension) || (extension === '.json' && segments[4] === 'assets')) return relative;
  }
  return null;
}

function contentTypeFor(extension) {
  return CONTENT_TYPES[extension] || 'application/octet-stream';
}

function safeStaticPath(root, urlPath) {
  const relative = resolveStaticPath(urlPath);
  if (!relative) return null;
  const filePath = path.resolve(root, relative);
  return isWithin(root, filePath) ? filePath : null;
}

module.exports = { PAGE_ROUTES, LEGACY_ASSETS, SCRIPT_ASSETS, STYLE_ASSETS, contentTypeFor, resolveStaticPath, safeStaticPath };
