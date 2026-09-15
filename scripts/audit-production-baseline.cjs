// Diagnostic only: does not change project data or start Theia/terminal/builds.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createProjectHistory } = require('../backend/projects/history');
const { createCommunityStore } = require('../backend/community/store');
const { createSessionService } = require('../backend/auth/session-service');
const { createGameCatalog } = require('../backend/projects/game-catalog');
const { readJson, validateMeta, safeFile } = require('../backend/core/project-utils');

const digest = data => crypto.createHash('sha256').update(data).digest('hex');
async function main() {
  const repository = path.resolve(__dirname, '..');
  const report = { at: new Date().toISOString(), node: process.version, local: {}, http: [], fixtures: {} };
  const catalog = createGameCatalog({ gamesRoot: path.join(repository, 'games'), readJson, validateMeta });
  const games = await catalog.listGames();
  report.local.catalog = games.map(game => ({ id: game.id, version: game.version, versionCount: game.versionCount, hasVersionsArray: Array.isArray(game.versions) }));
  report.local.directories = [];
  for (const entry of await fs.readdir(path.join(repository, 'games'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const versions = await catalog.versions(entry.name);
    report.local.directories.push({ game: entry.name, versions: versions.map(v => v.name) });
  }
  report.local.versionLinks = [];
  for (const game of report.local.directories) {
    for (const version of await catalog.versions(game.game)) {
      const relative = String(version.meta?.playUrl || '').replace(/^\//, '');
      report.local.versionLinks.push({ game: game.game, version: version.name, playExists: !!relative && await fs.stat(path.join(repository, relative)).then(() => true, () => false) });
    }
  }
  report.local.testFiles = (await fs.readdir(path.join(repository, 'tests'))).filter(file => file.endsWith('.test.js')).length;
  const base = process.env.GV_AUDIT_BASE_URL || 'http://[::1]:8080';
  for (const route of ['/', '/theia.html', '/project-tools.js', '/editor.html', '/editor.js', '/editor-page.css', '/audit-missing-asset.css', '/server.js', '/package.json', '/backend/auth/admin-account.js', '/.vault/users.json', '/api/games', '/api/tree?game=t34-steel-front&version=v1.0.0']) {
    try {
      const response = await fetch(base + route, { signal: AbortSignal.timeout(5000) });
      const bytes = Buffer.from(await response.arrayBuffer());
      const item = { route, status: response.status, bytes: bytes.length };
      if (response.status === 500) {
        try { item.leaksHostPath = String(JSON.parse(bytes.toString('utf8')).error || '').includes(repository); }
        catch { item.leaksHostPath = bytes.includes(Buffer.from(repository)); }
      }
      if (route === '/server.js' && response.ok) item.matchesLocalSource = digest(bytes) === digest(await fs.readFile(path.join(repository, 'server.js')));
      report.http.push(item);
    } catch (error) { report.http.push({ route, unavailable: error.name }); }
  }
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'gv-production-audit-'));
  try {
    const project = path.join(fixture, 'project');
    await fs.mkdir(project);
    const original = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0x00, 0xc3, 0x28]);
    await fs.writeFile(path.join(project, 'binary.png'), original);
    await fs.writeFile(path.join(project, 'large.bin'), Buffer.alloc(1000000, 0xff));
    const history = createProjectHistory({ vaultRoot: path.join(fixture, 'vault') });
    const snapshot = await history.snapshot(project);
    report.fixtures.snapshot = { binaryRoundtripEqual: digest(original) === digest(Buffer.from(snapshot['binary.png'], 'utf8')), largeFileIncluded: Object.hasOwn(snapshot, 'large.bin') };
    report.fixtures.historyEscapesVault = !history.fileFor('..', 'outside').startsWith(path.join(fixture, 'vault') + path.sep);
    const sessions = createSessionService();
    const token = sessions.create({ id: 'fixture-user', role: 'user' });
    report.fixtures.sessionSurvivesNewService = !!createSessionService().user({ headers: { cookie: 'gv_session=' + token } });
    report.fixtures.concurrentComments = [];
    for (let trial = 0; trial < 3; trial++) {
      const community = createCommunityStore({ file: path.join(fixture, 'community-' + trial + '.json') });
      await Promise.all(Array.from({ length: 20 }, (_, i) => community.comment('demo', { userId: 'fixture-' + i, author: 'fixture', text: 'fixture comment ' + i })));
      report.fixtures.concurrentComments.push({ submitted: 20, stored: (await community.comments('demo')).length });
    }
    const outside = path.join(fixture, 'outside');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'sentinel.txt'), 'fixture only');
    try {
      await fs.symlink(outside, path.join(project, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
      report.fixtures.safeFileFollowsExternalLink = (await fs.readFile(safeFile(project, 'linked/sentinel.txt'), 'utf8')) === 'fixture only';
    } catch (error) { report.fixtures.symlinkProbeUnavailable = error.code; }
  } finally {
    const absolute = path.resolve(fixture);
    const expectedParent = path.resolve(os.tmpdir());
    if (path.dirname(absolute) !== expectedParent || !path.basename(absolute).startsWith('gv-production-audit-')) throw new Error('Unexpected fixture cleanup target');
    await fs.rm(absolute, { recursive: true, force: true });
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error.name + ': ' + error.message); process.exitCode = 1; });
