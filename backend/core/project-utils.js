const fs = require('node:fs');
const path = require('node:path');

const requiredMetadataKeys = ['id', 'Order', 'name', 'slug', 'description', 'ai', 'category', 'image', 'playUrl', 'downloadUrl', 'version'];

function safePart(value) {
  return typeof value === 'string' && value.length > 0 && !value.includes('..') && !/[\\/:\0]/.test(value) && /^[\w. ()-]+$/u.test(value);
}

function safeFile(root, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) throw new Error('مسیر فایل نامعتبر است');
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('دسترسی خارج از پروژه مجاز نیست');
  return resolved;
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.promises.readFile(file, 'utf8')); }
  catch { return fallback; }
}

function validateMeta(meta) {
  const missing = requiredMetadataKeys.filter(key => meta[key] === undefined || meta[key] === null || meta[key] === '');
  if (missing.length) return `کلیدهای اجباری ناقص: ${missing.join(', ')}`;
  return null;
}

function readmeMarkdown(meta) {
  return `# ${meta.name}\n\n${meta.description}\n\n## اطلاعات\n\n- نسخه: ${meta.version}\n- دسته‌بندی: ${meta.category}\n- هوش سازنده: ${meta.ai || '—'}\n- وضعیت: ${meta.status || 'draft'}\n`;
}

module.exports = { requiredMetadataKeys, safePart, safeFile, readJson, validateMeta, readmeMarkdown };
