const assert = require('node:assert/strict');
const path = require('node:path');
const { safePart, safeFile, validateMeta, readmeMarkdown } = require('../backend/core/project-utils');

assert.equal(safePart('t34-steel-front'), true);
assert.equal(safePart('../outside'), false);
assert.equal(safePart('bad/name'), false);

const root = path.resolve('games', 'xc', 'versions', 'v1.0.0');
assert.equal(safeFile(root, 'game.html'), path.join(root, 'game.html'));
assert.throws(() => safeFile(root, '../outside.txt'), /خارج از پروژه/);

const meta = { id:'x', Order:'1', name:'X', slug:'x', description:'متن', ai:'AI', category:'test', image:'cover.png', playUrl:'game.html', downloadUrl:'game.html', version:'v1.0.0' };
assert.equal(validateMeta(meta), null);
assert.match(validateMeta({}), /کلیدهای اجباری ناقص/);
assert.match(readmeMarkdown(meta), /# X/);
assert.match(readmeMarkdown(meta), /نسخه: v1.0.0/);
assert.doesNotMatch(readmeMarkdown(meta), /امتیاز/);
console.log('project utilities passed');
