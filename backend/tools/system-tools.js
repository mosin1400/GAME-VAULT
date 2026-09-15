const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

function run(command, args = [], options = {}) {
  return new Promise(resolve => {
    execFile(command, args, { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024, ...options }, (error, stdout = '', stderr = '') => {
      resolve({ ok: !error, code: error?.code ?? 0, stdout: String(stdout), stderr: String(stderr), error: error?.message || '' });
    });
  });
}

async function locateVSCode() {
  if (process.platform !== 'win32') {
    const check = await run('which', ['code']);
    return { installed: check.ok, command: check.ok ? check.stdout.trim() : '', protocol: 'vscode://' };
  }
  const check = await run('where.exe', ['code']);
  if (check.ok) return { installed: true, command: check.stdout.split(/\r?\n/).find(Boolean).trim(), protocol: 'vscode://' };
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
    path.join(process.env.ProgramFiles || '', 'Microsoft VS Code', 'bin', 'code.cmd'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft VS Code', 'bin', 'code.cmd')
  ];
  const command = candidates.find(fs.existsSync) || '';
  return { installed: !!command, command, protocol: 'vscode://' };
}

async function projectStats(root) {
  let files = 0, bytes = 0, assets = 0;
  const byType = {};
  async function scan(directory) {
    for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await scan(full);
      else {
        const size = (await fs.promises.stat(full)).size;
        const extension = path.extname(entry.name).slice(1).toLowerCase() || 'other';
        files++; bytes += size; byType[extension] = (byType[extension] || 0) + size;
        if (/^(png|jpe?g|gif|webp|svg|mp3|wav|ogg|mp4|webm)$/i.test(extension)) assets += size;
      }
    }
  }
  await scan(root);
  return { files, bytes, assets, byType };
}

async function gitInfo(root) {
  const status = await run('git', ['-C', root, 'status', '--porcelain=v1', '-b']);
  if (!status.ok) return { available: false, reason: 'این پوشه Git repository نیست یا Git نصب نشده است.' };
  const stat = await run('git', ['-C', root, 'diff', '--stat']);
  const lines = status.stdout.split(/\r?\n/).filter(Boolean);
  return { available: true, branch: lines.shift()?.replace('## ', '') || '', changes: lines.map(line => ({ code: line.slice(0, 2), path: line.slice(3) })), summary: stat.stdout.trim() };
}

module.exports = { run, locateVSCode, projectStats, gitInfo };
