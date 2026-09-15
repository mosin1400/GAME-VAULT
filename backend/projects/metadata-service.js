const fs = require('node:fs');
const path = require('node:path');

function createMetadataService({ readJson, validateMeta, readmeMarkdown }) {
  async function repair(root, { game, version, preserveReadme = false }) {
    const file = path.join(root, 'game.json');
    const current = await readJson(file, {});
    const metadata = {
      ...current,
      id: game,
      Order: '1',
      name: current.name || game,
      slug: game,
      description: current.description || 'توضیحات این بازی را وارد کنید.',
      ai: current.ai || 'نامشخص',
      category: current.category || 'بدون دسته‌بندی',
      image: current.image || 'cover.png',
      playUrl: current.playUrl || 'game.html',
      downloadUrl: current.downloadUrl || 'game.html',
      version,
      status: current.status || 'draft',
      id: game,
      slug: game,
      version,
      Order: String(current.Order || '1')
    };
    delete metadata.rating;
    const error = validateMeta(metadata);
    if (error) throw new Error(error);
    await fs.promises.mkdir(root, { recursive: true });
    if (JSON.stringify(current) !== JSON.stringify(metadata)) await fs.promises.writeFile(file, JSON.stringify(metadata, null, 2));
    const readmeFile = path.join(root, 'README.md');
    let existingReadme;
    try { existingReadme = await fs.promises.readFile(readmeFile, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const generated = readmeMarkdown(metadata);
    if ((!preserveReadme || existingReadme === undefined) && existingReadme !== generated) await fs.promises.writeFile(readmeFile, generated);
    return { meta: metadata, created: !Object.keys(current).length };
  }
  return { repair };
}

module.exports = { createMetadataService };
