const assert=require('node:assert/strict');
const {toolDefinition,requiredTools}=require('../backend/builds/tools');
assert.throws(()=>toolDefinition('rm-rf'),/ابزار معتبر نیست/);
assert.equal(toolDefinition('java').sizeLabel,'حدود ۲۰۰ تا ۴۰۰ مگابایت');
assert.equal(toolDefinition('electron-builder').check[0],'npm.cmd');
assert.ok(toolDefinition('android-sdk').install);
assert.ok(toolDefinition('docker').install);
assert.ok(requiredTools(['android-apk']).some(tool=>tool.id==='android-sdk'));
console.log('build tools contract passed');
