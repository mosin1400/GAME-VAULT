const assert=require('node:assert/strict');
const path=require('node:path');
const {buildOutputDir,requireLinuxHost,requireAndroidToolchain}=require('../backend/builds/runner');
assert.match(buildOutputDir('C:/vault',{game:'xc',version:'v1.0.0',id:'job-1'}),/vault[\\/]xc[\\/]v1\.0\.0[\\/]job-1$/);
assert.throws(()=>requireLinuxHost({wsl:false,docker:false}),/WSL یا Docker/);
assert.throws(()=>requireAndroidToolchain({java:false,androidSdk:false}),/Java LTS و Android SDK/);
console.log('build runner contract passed');
