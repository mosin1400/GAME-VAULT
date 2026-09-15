const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const testRoot = path.join(__dirname, '.tmp-build-store');
fs.rmSync(testRoot, {recursive:true, force:true});
const {createBuildStore} = require('../backend/builds/store');

(async()=>{
  const store = createBuildStore({root:testRoot, safePart:value=>/^[\w.-]+$/.test(value)});
  const job = await store.createBuildJob({game:'xc',version:'v1.0.0',targets:['windows-zip']});
  assert.equal(job.status, 'queued');
  assert.equal((await store.getBuildJob(job.id)).game, 'xc');
  assert.throws(()=>store.validateBuildInput({game:'../bad',version:'v1',targets:['windows-zip']}),/معتبر نیست/);
  fs.rmSync(testRoot, {recursive:true, force:true});
  console.log('build store contract passed');
})().catch(error=>{console.error(error);process.exit(1)});
