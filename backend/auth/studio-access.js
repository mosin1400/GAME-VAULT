const crypto = require('node:crypto');

function createStudioAccess({ now = () => Date.now(), ttlMs = 8 * 60 * 60 * 1000 } = {}) {
  const tokens = new Map();

  function issue(user) {
    const token = crypto.randomBytes(32).toString('hex');
    tokens.set(token, { user, expiresAt: now() + ttlMs });
    return token;
  }

  function user(request) {
    const token = String(request.headers?.['x-gv-studio-token'] || '');
    const entry = tokens.get(token);
    if (!entry || entry.expiresAt <= now()) {
      if (entry) tokens.delete(token);
      return null;
    }
    return entry.user;
  }

  function admin(request) { return user(request)?.role === 'admin'; }
  return { issue, user, admin };
}

module.exports = { createStudioAccess };
