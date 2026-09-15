const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { safeStaticPath, contentTypeFor } = require('./static-assets');
const { isWithin } = require('../core/protected-paths');

async function noLinks(file) {
  let current = path.resolve(file);
  for (;;) {
    if ((await fs.lstat(current)).isSymbolicLink()) throw Error('UNSAFE_LINK');
    const parent = path.dirname(current); if (current === parent) return;
    current = parent;
  }
}
function sameFile(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}
async function readPublicFile(root, file) {
  await noLinks(file);
  const before = await fs.lstat(file);
  if (!before.isFile() || before.nlink > 1) throw Error('UNSAFE_FILE');
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    await noLinks(file);
    if (!isWithin(await fs.realpath(root), await fs.realpath(file)) || !sameFile(before, await handle.stat())) throw Error('UNSAFE_FILE');
    const bytes = await handle.readFile();
    await noLinks(file);
    if (!sameFile(before, await handle.stat()) || !sameFile(before, await fs.lstat(file))) throw Error('FILE_CHANGED');
    return bytes;
  } finally { await handle.close(); }
}
async function serveStatic(root, req, res, pathname) {
  const headers = { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store, max-age=0, must-revalidate' };
  function reply(status, body, extra = {}) { res.writeHead(status, { ...headers, ...extra }); res.end(req.method === 'HEAD' ? undefined : body); }
  if (!['GET', 'HEAD'].includes(req.method)) return reply(405, 'Method not allowed', { allow: 'GET, HEAD' });
  const file = safeStaticPath(root, pathname);
  if (!file) return reply(404, 'Not found');
  try {
    const bytes = await readPublicFile(root, file);
    return reply(200, bytes, { 'content-type': contentTypeFor(path.extname(file).toLowerCase()), 'content-length': bytes.length });
  } catch (error) {
    const unavailable = ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'ELOOP', 'UNSAFE_LINK', 'UNSAFE_FILE', 'FILE_CHANGED'].includes(error.code || error.message);
    return reply(unavailable ? 404 : 500, unavailable ? 'Not found' : 'Internal server error');
  }
}
module.exports = { serveStatic };
