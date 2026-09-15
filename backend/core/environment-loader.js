const path = require('node:path');

function loadEnvironmentFiles({ root, fs, environment = process.env, enabled = true }) {
  if (!enabled) return { loaded: 0, skipped: true };
  let loaded = 0;
  for (const envPath of [path.join(root, '.env'), path.join(root, 'api', '.env')]) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (match && !environment[match[1]]) {
        environment[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
        loaded++;
      }
    }
  }
  return { loaded, skipped: false };
}

module.exports = { loadEnvironmentFiles };
