const assert = require('node:assert/strict');
const { createSessionService } = require('../backend/auth/session-service');

const sessions = createSessionService();
const token = sessions.create({ id: 'admin-local', username: 'admin', name: 'ادمین', avatar: 'A', role: 'admin' });
const request = { headers: { cookie: `other=x; gv_session=${token}` } };

assert.equal(sessions.isAuthenticated(request), true);
assert.equal(sessions.isAdmin(request), true);
assert.equal(sessions.user(request).username, 'admin');
assert.deepEqual(sessions.publicUser(sessions.user(request)), { id: 'admin-local', username: 'admin', name: 'ادمین', avatar: 'A', role: 'admin' });
sessions.remove(token);
assert.equal(sessions.isAuthenticated(request), false);
console.log('session service passed');
