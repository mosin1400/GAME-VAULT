const path = require('node:path');

// The user's environment files must never be inspected by diagnostics/backups.
function isProtectedEnvironmentPath(value) {
  if (typeof value !== 'string') return false;
  return value.split(/[\\/]/).some(segment => {
    const name = segment.replace(/[. ]+$/g, '').toLowerCase();
    return name === '.env' || name.startsWith('.env.') || name.endsWith('.env');
  });
}

function isWithin(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

module.exports = { isProtectedEnvironmentPath, isWithin };
