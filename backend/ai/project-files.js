const fs = require('node:fs');
const path = require('node:path');

const textFilePattern = /\.(html?|css|js|json|md|txt|svg|xml)$/i;
const protectedMetadataFiles = ['game.json', 'README.md'];

async function collectProjectFiles(root, { maximumFileBytes = 120000, maximumTotalBytes = 350000 } = {}) {
  const files = {};
  let total = 0;
  async function scan(directory) {
    for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      const relative = path.relative(root, full).replaceAll('\\', '/');
      if (entry.isDirectory()) await scan(full);
      else if (textFilePattern.test(entry.name) && !protectedMetadataFiles.includes(entry.name)) {
        const stat = await fs.promises.stat(full);
        if (stat.size > maximumFileBytes || total + stat.size > maximumTotalBytes) continue;
        files[relative] = await fs.promises.readFile(full, 'utf8');
        total += stat.size;
      }
    }
  }
  await scan(root);
  return files;
}

function extractJson(content) {
  const text = String(content || '').trim();
  const block = text.match(/```json\s*([\s\S]*?)```/i);
  return JSON.parse(block ? block[1] : text);
}

module.exports = { textFilePattern, protectedMetadataFiles, collectProjectFiles, extractJson };
