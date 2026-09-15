const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const gamesRoot = path.join(root, 'games');
const aiFiles = fs.readFileSync(path.join(root, 'backend', 'ai', 'project-files.js'), 'utf8');

assert.match(aiFiles, /protectedMetadataFiles/, 'AI must centralize protected metadata files');
assert.match(aiFiles, /game\.json/, 'AI must protect game.json');
assert.match(aiFiles, /README\.md/, 'AI must protect README.md');

function folders(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}

let recognizedVersions = 0;
const importedSources = [];
for (const game of folders(gamesRoot)) {
  const versionsRoot = path.join(gamesRoot, game, 'versions');
  // Imported application source is not yet a recognized versioned game.
  if (!fs.existsSync(versionsRoot)) { importedSources.push(game); continue; }
  assert.ok(fs.statSync(versionsRoot).isDirectory(), `${game} versions must be a directory`);
  for (const version of folders(versionsRoot)) {
    recognizedVersions++;
    const versionRoot = path.join(versionsRoot, version);
    const metadataPath = path.join(versionRoot, 'game.json');
    const readmePath = path.join(versionRoot, 'README.md');
    assert.ok(fs.existsSync(metadataPath), `${game}/${version} must have game.json`);
    assert.ok(fs.existsSync(readmePath), `${game}/${version} must have README.md`);
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    assert.equal(metadata.version, version, `${game}/${version} metadata version must match its folder`);
    assert.match(fs.readFileSync(readmePath, 'utf8'), new RegExp(`نسخه: ${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${game}/${version} README must match its metadata version`);
    assert.equal(metadata.slug, game, `${game}/${version} metadata slug must match its game folder`);
    assert.ok(metadata.name?.trim(), `${game}/${version} metadata must have a name`);
    assert.ok(metadata.description?.trim(), `${game}/${version} metadata must have a description`);
    assert.ok(!fs.existsSync(path.join(versionRoot, 'readme.json')), `${game}/${version} must not retain legacy readme.json`);
  }
}
assert.ok(recognizedVersions > 0, 'validate actual versioned data; do not pass vacuously');
console.log(`${importedSources.length} unversioned imports remain pending classification`);

console.log('project layout contract passed');
