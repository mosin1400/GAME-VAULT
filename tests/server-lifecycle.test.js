const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { installGracefulShutdown } = require('../backend/core/server-lifecycle');

const processRef = new EventEmitter();
const events = [];
const server = { close(done) { events.push('server.close'); done(); } };
const child = { killed: false, kill(signal) { events.push(`child.${signal}`); this.killed = true; } };
const uninstall = installGracefulShutdown({
  processRef,
  server,
  children: () => [child],
  exit: code => events.push(`exit.${code}`),
  forceExitAfterMs: 0,
});

processRef.emit('SIGTERM');
processRef.emit('SIGINT');
assert.deepEqual(events, ['child.SIGTERM', 'server.close', 'exit.0']);
uninstall();
console.log('server lifecycle contract passed');
