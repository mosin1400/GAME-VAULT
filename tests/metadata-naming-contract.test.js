const assert = require('node:assert/strict');
const fs = require('node:fs');

const skill = fs.readFileSync('skills/metadata-auditor/skill.json', 'utf8');
const instructions = fs.readFileSync('skills/metadata-auditor/instructions.md', 'utf8');
const server = fs.readFileSync('server.js', 'utf8');
assert.match(skill, /game\.json/);
assert.match(instructions, /game\.json/);
assert.doesNotMatch(skill, /readme\.json/i);
assert.doesNotMatch(instructions, /readme\.json/i);
assert.doesNotMatch(server, /readme\.json/i, 'server prompts and rewrite guards must use game.json only');
console.log('metadata naming contract passed');
