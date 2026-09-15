const crypto = require('node:crypto');

function createSessionService() {
  const store = new Map();

  function tokenFrom(request) {
    const cookie = request.headers?.cookie || '';
    return cookie.split(';').map(value => value.trim()).find(value => value.startsWith('gv_session='))?.slice('gv_session='.length);
  }
  function user(request) {
    const token = tokenFrom(request);
    return token ? store.get(token) : null;
  }
  function create(account) {
    const token = crypto.randomBytes(24).toString('hex');
    store.set(token, account);
    return token;
  }
  function remove(token) { if (token) store.delete(token); }
  function isAuthenticated(request) { return !!user(request); }
  function isAdmin(request) { return user(request)?.role === 'admin'; }
  function publicUser(account) {
    return account ? { id: account.id, username: account.username, name: account.name, avatar: account.avatar || '', role: account.role } : null;
  }
  function replaceUser(id, update) {
    for (const [token, account] of store) if (account.id === id) store.set(token, { ...account, ...update });
  }

  return { create, remove, tokenFrom, user, isAuthenticated, isAdmin, publicUser, replaceUser };
}

module.exports = { createSessionService };
