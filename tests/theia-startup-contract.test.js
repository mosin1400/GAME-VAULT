const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('server.js', 'utf8');

assert.match(server, /"node_modules",\s*"@theia",\s*"cli",\s*"bin",\s*"theia\.js"/, 'Theia must be launched through its absolute CLI entry point');
assert.doesNotMatch(server, /shell:\s*process\.platform === "win32"/, 'Theia must not use a Windows command shell that loses its working directory');
console.log('Theia startup contract passed');
