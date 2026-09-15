const fs = require('node:fs');
const path = require('node:path');
const { textFilePattern } = require('./project-files');

function createAgentTools({ root }) {
  function safe(relative) {
    const file = path.resolve(root, String(relative || ''));
    if (!file.startsWith(root + path.sep)) throw new Error('مسیر ابزار Agent معتبر نیست');
    return file;
  }
  async function listFiles() {
    const paths = [];
    async function walk(directory) {
      for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) await walk(full);
        else paths.push(path.relative(root, full).replaceAll('\\', '/'));
      }
    }
    await walk(root); return { paths: paths.sort() };
  }
  async function readFile(relative) {
    const file = safe(relative);
    if (!textFilePattern.test(file)) throw new Error('فقط فایل متنی قابل خواندن است');
    return { path: path.relative(root, file).replaceAll('\\', '/'), content: await fs.promises.readFile(file, 'utf8') };
  }
  async function searchText(query) {
    const needle = String(query || '').toLowerCase();
    if (!needle) throw new Error('متن جست‌وجو خالی است');
    const { paths } = await listFiles(), matches = [];
    for (const relative of paths) {
      if (!textFilePattern.test(relative)) continue;
      const content = (await readFile(relative)).content;
      content.split(/\r?\n/).forEach((line, index) => { if (line.toLowerCase().includes(needle)) matches.push({ path: relative, line: index + 1, text: line.trim().slice(0, 240) }); });
    }
    return { matches: matches.slice(0, 200) };
  }
  return { listFiles, readFile, searchText };
}
module.exports = { createAgentTools };
