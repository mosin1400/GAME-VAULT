const fs = require('node:fs');
const path = require('node:path');
const { textFilePattern, collectProjectFiles } = require('./project-files');

function safeActiveFile(root, relative) {
  if (!relative) return null;
  const candidate = path.resolve(root, String(relative));
  if (!candidate.startsWith(root + path.sep) || !textFilePattern.test(candidate)) return null;
  return candidate;
}

async function buildAgentContext(root, { activeFile = '', maximumFileBytes = 120000, maximumTotalBytes = 350000 } = {}) {
  const files = await collectProjectFiles(root, { maximumFileBytes, maximumTotalBytes });
  for (const protectedFile of ['game.json', 'README.md']) {
    const candidate = path.join(root, protectedFile);
    try {
      const stat = await fs.promises.stat(candidate);
      if (stat.size <= maximumFileBytes) files[protectedFile] = await fs.promises.readFile(candidate, 'utf8');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const activePath = safeActiveFile(root, activeFile);
  let active = null;
  if (activePath) {
    try {
      const stat = await fs.promises.stat(activePath);
      if (stat.isFile() && stat.size <= maximumFileBytes) active = { path: path.relative(root, activePath).replaceAll('\\', '/'), content: await fs.promises.readFile(activePath, 'utf8') };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { paths: Object.keys(files).sort(), files, activeFile: active };
}

module.exports = { buildAgentContext };
