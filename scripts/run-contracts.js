const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const tests = fs.readdirSync(path.join(__dirname, '..', 'tests'))
  .filter(file => file.endsWith('.test.js'))
  .sort();

const concurrency = 4;
let cursor = 0;
let failed = false;

function run(file) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join('tests', file)], { stdio: 'inherit' });
    child.on('exit', code => { if (code !== 0) failed = true; resolve(); });
    child.on('error', () => { failed = true; resolve(); });
  });
}

async function worker() {
  while (cursor < tests.length) await run(tests[cursor++]);
}

Promise.all(Array.from({ length: Math.min(concurrency, tests.length) }, worker))
  .then(() => { process.exitCode = failed ? 1 : 0; });
