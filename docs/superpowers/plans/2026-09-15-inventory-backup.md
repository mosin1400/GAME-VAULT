# Game Vault Inventory and Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a binary-safe inventory and a verified external backup/restore of the current project before changing its product data.

**Architecture:** Read-only discovery followed by copying a frozen source tree into a new restricted external directory. Byte checksums and independent restoration verify preservation; application baseline checks verify runtime restoration separately.

**Tech Stack:** Existing Node.js built-in fs/path/crypto/node:test, Windows PowerShell process/directory diagnostics; existing root and Theia package locks.

## Global Constraints

- Inventory and a verified restore are required before changing product data.
- Links and special files are recorded, not dereferenced or copied as ordinary files.
- Backup destination must be an explicit absolute directory outside the workspace; validate resolved paths and reject any link/reparse-point ancestor before copying.
- No UTF-8 conversion is used for binary preservation.
- Diagnostic reports never contain secret values.
- Environment paths are protected before any file open/hash/copy: case-insensitive `.env`, `.env.*`, `*.env` at any depth, including examples/directories. Record excluded names only. Never invoke the original server's environment loader for validation.
- The backup excludes credentials (`secretsIncluded:false`); byte verification and runtime verification are separate gates. A running-writer backup remains provisional even if its hashes match.
- Current baseline: 46 contract-test files, 40 passed and six failed; known failures are recorded, not mislabeled as fully passing.
- Current backup covers the post-legacy-deletion state; it does not recreate a missing pre-deletion backup.
- No Git repository exists currently; do not claim a commit/worktree. Preserve task evidence until version control is established in P02.

---

## Task 1: Deterministic binary inventory

Implementation update: the checked-in modules and seven behavioral tests are authoritative. The original illustrative code below predates the protected-path policy and must not be copied over the hardened implementation. RED (missing module) and GREEN (7/7) were verified; the real external backup/runtime gates remain separate.

**Files:**
- Create `scripts/migration/inventory.cjs`
- Create `tests/migration/inventory-backup.test.cjs`

**Interfaces:**
- Consumes: `createInventory(root: absolutePath)`; source bytes, directory/link metadata.
- Produces: `Inventory {schemaVersion:1, sourceRoot, entries}`; `digestEntries(entries):sha256`.
- Generated folders: every `.git` and `node_modules` directory is listed as generated and not traversed. All other regular files/directories are preserved; links/special files are quarantined metadata.

- [ ] **Step 1: Write failing behavioral tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createInventory, digestEntries } = require('../../scripts/migration/inventory.cjs');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gv-backup-test-'));
  t.after(async () => {
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('gv-backup-test-')) throw Error('Unsafe test cleanup');
    await fs.rm(root, { recursive:true, force:true });
  });
  return root;
}
test('inventory preserves Unicode paths and hashes raw binary bytes', async t => {
  const root = await fixture(t), source = path.join(root,'source');
  await fs.mkdir(source);
  const bytes = Buffer.from([0x89,0xff,0,0xc3,0x28]);
  await fs.writeFile(path.join(source,'تصویر (1).png'),bytes);
  await fs.mkdir(path.join(source,'node_modules'));
  await fs.writeFile(path.join(source,'node_modules','generated.txt'),'excluded');
  const a = await createInventory(source), b = await createInventory(source);
  const file = a.entries.find(e=>e.path==='تصویر (1).png');
  assert.equal(file.sha256,crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.equal(file.bytes,bytes.length);
  assert.equal(digestEntries(a.entries),digestEntries(b.entries));
  assert.equal(a.entries.some(e=>e.path==='node_modules/generated.txt'),false);
});
test('inventory records links without reading their external target', async t => {
  const root=await fixture(t), source=path.join(root,'source'), outside=path.join(root,'outside');
  await fs.mkdir(source); await fs.mkdir(outside);
  await fs.writeFile(path.join(outside,'sentinel.txt'),'fixture only');
  await fs.symlink(outside,path.join(source,'linked'),process.platform==='win32'?'junction':'dir');
  const inventory=await createInventory(source);
  assert.equal(inventory.entries.find(e=>e.path==='linked').kind,'link');
  assert.equal(inventory.entries.some(e=>e.path==='linked/sentinel.txt'),false);
});
```

- [ ] **Step 2: Run and confirm missing-module failure**

Run: `node --test tests/migration/inventory-backup.test.cjs`.
Expected: module-not-found for inventory.cjs before creating the module. A link creation failure must be reported as environment failure, not silently counted as passing containment.

- [ ] **Step 3: Implement inventory with built-in APIs**

```js
// scripts/migration/inventory.cjs
const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function hashFile(file){
  const sum=crypto.createHash('sha256');let bytes=0;
  for await(const chunk of createReadStream(file)){sum.update(chunk);bytes+=chunk.length}
  return {bytes,sha256:sum.digest('hex')};
}
async function assertNoLinkAncestors(input) {
  if(!path.isAbsolute(input)) throw Error('ABSOLUTE_PATH_REQUIRED');
  let current=path.resolve(input);
  for(;;){
    const stat=await fs.lstat(current).catch(e=>{if(e.code==='ENOENT')return null;throw e});
    if(stat?.isSymbolicLink()) throw Error('LINK_ANCESTOR_REJECTED');
    const parent=path.dirname(current);if(parent===current)break;current=parent;
  }
}
async function createInventory(input) {
  await assertNoLinkAncestors(input);
  const sourceRoot=path.resolve(input), entries=[];
  if(!(await fs.lstat(sourceRoot)).isDirectory()) throw Error('DIRECTORY_REQUIRED');
  async function scan(dir,base=''){
    const children=await fs.readdir(dir,{withFileTypes:true});
    children.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
    for(const child of children){
      const full=path.join(dir,child.name),relative=base?base+'/'+child.name:child.name;
      const stat=await fs.lstat(full);
      if(stat.isSymbolicLink()) { entries.push({path:relative,kind:'link',migrationClass:'quarantine'});continue; }
      if(stat.isDirectory()){
        const generated=['node_modules','.git'].includes(child.name);
        entries.push({path:relative,kind:'directory',mode:stat.mode&0o777,migrationClass:generated?'generated':'preserve'});
        if(!generated) await scan(full,relative);
      } else if(stat.isFile()){
        const content=await hashFile(full);
        entries.push({path:relative,kind:'file',...content,mode:stat.mode&0o777,migrationClass:'preserve'});
      } else entries.push({path:relative,kind:'special',migrationClass:'quarantine'});
    }
  }
  await scan(sourceRoot);
  return {schemaVersion:1,sourceRoot,entries};
}
function digestEntries(entries){return hash(JSON.stringify(entries.filter(e=>e.migrationClass==='preserve')))}
module.exports={createInventory,digestEntries,assertNoLinkAncestors};
```

The file is an inventory primitive, not a claim of full project-format classification. P06 classifies entry points from this retained inventory.
Read bytes only after writer freeze for the final backup; discovery before freeze is labeled provisional.

- [ ] **Step 4: Run inventory behavior tests**

Run: `node --test tests/migration/inventory-backup.test.cjs`.
Expected: binary/Unicode/generated/link cases pass, no read outside fixture source.

- [ ] **Step 5: Record delivery evidence**

Save test result and inventory schema version in the package receipt. If a repository now exists, commit only source/test/docs, never data/secrets/backup manifests.

## Task 2: Copy, independent verify and restore

**Files:**
- Create `scripts/migration/verify.cjs`
- Create `scripts/migration/backup.cjs`
- Extend `tests/migration/inventory-backup.test.cjs`

**Interfaces:**
- Consumes: Task1 frozen Inventory and explicit new destination.
- Produces: `backupInventory(inventory,destination) -> {backupRoot,inventoryHash}`; `verifyInventory(inventory,copiedRoot) -> {verified:true,inventoryHash}`; `restoreBackup(backupRoot,newTarget) -> verified receipt`.
- Unresolved link/special entries reject a complete backup; record/quarantine decisions first. The generated dependency directories are rebuilt from preserved lockfiles in Task3.

- [ ] **Step 1: Add failing preservation/rejection tests**

```js
// Append to tests/migration/inventory-backup.test.cjs
const {backupInventory,restoreBackup}=require('../../scripts/migration/backup.cjs');
const {verifyInventory}=require('../../scripts/migration/verify.cjs');
test('backup and independent restore preserve bytes; tampering is rejected',async t=>{
  const root=await fixture(t),source=path.join(root,'source');await fs.mkdir(source);
  const bytes=Buffer.from([0xff,0,0x89,0xc3]);await fs.writeFile(path.join(source,'image.bin'),bytes);
  const inventory=await createInventory(source),backup=path.join(root,'backup'),restore=path.join(root,'restore');
  await backupInventory(inventory,backup);await restoreBackup(backup,restore);
  assert.deepEqual(await fs.readFile(path.join(restore,'image.bin')),bytes);
  await fs.writeFile(path.join(backup,'data','image.bin'),Buffer.from([1]));
  await assert.rejects(verifyInventory(inventory,path.join(backup,'data')),/INTEGRITY_MISMATCH/);
});
test('backup rejects source-contained targets and a source changed since inventory',async t=>{
  const root=await fixture(t),source=path.join(root,'source');await fs.mkdir(source);
  await fs.writeFile(path.join(source,'a.txt'),'before');const inventory=await createInventory(source);
  await assert.rejects(backupInventory(inventory,path.join(source,'backup')),/OVERLAPPING_ROOTS/);
  await fs.writeFile(path.join(source,'a.txt'),'after');
  await assert.rejects(backupInventory(inventory,path.join(root,'backup')),/SOURCE_CHANGED/);
});
test('restore never merges into an existing target',async t=>{
  const root=await fixture(t),source=path.join(root,'source'),backup=path.join(root,'backup'),restore=path.join(root,'restore');
  await fs.mkdir(source);await fs.writeFile(path.join(source,'a.txt'),'a');
  await backupInventory(await createInventory(source),backup);await fs.mkdir(restore);
  await assert.rejects(restoreBackup(backup,restore),/TARGET_EXISTS/);
});
```

- [ ] **Step 2: Confirm failing module import**

Run: `node --test tests/migration/inventory-backup.test.cjs`.
Expected: backup/verify modules missing; Task1 tests still pass when run before new imports are introduced.

- [ ] **Step 3: Implement independent verification**

```js
// scripts/migration/verify.cjs
const {createInventory,digestEntries}=require('./inventory.cjs');
async function verifyInventory(inventory,copiedRoot){
  const actual=await createInventory(copiedRoot);
  if(actual.entries.some(e=>e.migrationClass==='quarantine')||digestEntries(actual.entries)!==digestEntries(inventory.entries))throw Error('INTEGRITY_MISMATCH');
  return {verified:true,inventoryHash:digestEntries(inventory.entries)};
}
module.exports={verifyInventory};
```

- [ ] **Step 4: Implement copy and restore into fresh roots**

```js
// scripts/migration/backup.cjs
const fs=require('node:fs/promises'),path=require('node:path');
const {createInventory,digestEntries,assertNoLinkAncestors}=require('./inventory.cjs');
const {verifyInventory}=require('./verify.cjs');
function inside(a,b){const relative=path.relative(a,b);return relative===''||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep))}
async function prepare(source,target){
  await assertNoLinkAncestors(source);await assertNoLinkAncestors(target);
  const a=path.resolve(source),b=path.resolve(target);
  if(inside(a,b)||inside(b,a))throw Error('OVERLAPPING_ROOTS');
  if(await fs.lstat(b).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e}))throw Error('TARGET_EXISTS');
  return {a,b};
}
async function copyEntries(inventory,source,target){
  const directories=[];
  for(const e of inventory.entries){
    if(e.migrationClass==='generated')continue;
    if(e.migrationClass!=='preserve')throw Error('UNRESOLVED_SPECIAL_ENTRY');
    const from=path.resolve(source,e.path),to=path.resolve(target,e.path);
    if(!inside(source,from)||!inside(target,to))throw Error('INVALID_MANIFEST_PATH');
    await assertNoLinkAncestors(from);await assertNoLinkAncestors(to);
    if(e.kind==='directory'){await fs.mkdir(to,{recursive:true,mode:0o700});directories.push({to,mode:e.mode});}
    else if(e.kind==='file'){
      await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(from,to);await fs.chmod(to,e.mode);
    }else throw Error('UNSUPPORTED_ENTRY');
  }
  for(const directory of directories.reverse())await fs.chmod(directory.to,directory.mode);
}
async function backupInventory(inventory,destination){
  const {a,b}=await prepare(inventory.sourceRoot,destination);
  if(inventory.entries.some(e=>e.migrationClass==='quarantine'))throw Error('UNRESOLVED_SPECIAL_ENTRY');
  if(digestEntries((await createInventory(a)).entries)!==digestEntries(inventory.entries))throw Error('SOURCE_CHANGED');
  await fs.mkdir(b);const data=path.join(b,'data');await fs.mkdir(data);
  await copyEntries(inventory,a,data);const receipt=await verifyInventory(inventory,data);
  if(digestEntries((await createInventory(a)).entries)!==digestEntries(inventory.entries))throw Error('SOURCE_CHANGED');
  await fs.writeFile(path.join(b,'inventory.json'),JSON.stringify(inventory,null,2));
  await fs.writeFile(path.join(b,'receipt.json'),JSON.stringify({...receipt,createdAt:new Date().toISOString()},null,2));
  return {backupRoot:b,...receipt};
}
async function restoreBackup(backupRoot,newTarget){
  await prepare(backupRoot,newTarget);
  const inventory=JSON.parse(await fs.readFile(path.join(backupRoot,'inventory.json'),'utf8'));
  const receipt=JSON.parse(await fs.readFile(path.join(backupRoot,'receipt.json'),'utf8'));
  if(receipt.inventoryHash!==digestEntries(inventory.entries))throw Error('MANIFEST_MISMATCH');
  const source=path.join(path.resolve(backupRoot),'data');await verifyInventory(inventory,source);
  const target=path.resolve(newTarget);await fs.mkdir(target);await copyEntries(inventory,source,target);
  return verifyInventory(inventory,target);
}
module.exports={backupInventory,restoreBackup};
```

Partial destinations stay available for diagnosis; these modules never delete source or backup roots.
This is a local frozen-tree primitive. It is not a replacement for production DB-consistent backup/PITR or encryption.

- [ ] **Step 5: Run preservation and rejection tests**

Run: `node --test tests/migration/inventory-backup.test.cjs`.
Expected: all tests pass; binary bytes equal; altered source/backup and existing target are rejected.
Add test fixture with executable mode on Linux and assert copied mode; on Windows verify inherited ACL separately in Task3.

- [ ] **Step 6: Record module/test evidence**

Receipt states generated dependencies excluded and current copy verification complete. It does not yet claim full runtime restoration.

## Task 3: Actual frozen backup and runtime receipt

**Files:**
- Create `scripts/migration/cli.cjs`
- Create `docs/operations/local-backup.md`
- Private generated inventory/backup/restore receipts in the explicit external destination.

**Interfaces:**
- Consumes: Task1/2 modules; `node scripts/migration/cli.cjs SOURCE BACKUP RESTORE`.
- Produces: external inventory and byte-verified restore; then separate runtime receipt covering dependencies, baseline checks and writer freeze.

- [ ] **Step 1: Implement CLI using the delivered interfaces**

```js
// scripts/migration/cli.cjs
const path=require('node:path');
const {createInventory}=require('./inventory.cjs');
const {backupInventory,restoreBackup}=require('./backup.cjs');
async function main(){
  const [source,backup,restore,...extra]=process.argv.slice(2);
  if(!source||!backup||!restore||extra.length||![source,backup,restore].every(path.isAbsolute))throw Error('USAGE: cli.cjs ABS_SOURCE ABS_NEW_BACKUP ABS_NEW_RESTORE');
  const inventory=await createInventory(source);await backupInventory(inventory,backup);
  const receipt=await restoreBackup(backup,restore);
  console.log(JSON.stringify({verified:receipt.verified,inventoryHash:receipt.inventoryHash,files:inventory.entries.filter(e=>e.kind==='file').length,runtimeVerified:false}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
```

- [ ] **Step 2: Locate and freeze only verified project writers**

Read-only diagnostic command:

```powershell
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object LocalPort -In 8080,3010 |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

Port 8080 also has an unrelated Adobe Connect loopback listener in the earlier environment; never stop a process merely because it owns that port.
Match the IPv6 Game Vault response/source checksum and its Node listener, and prove ownership for Theia/agent/build processes.
Use owning-session graceful stop for verified workspace processes. If writer ownership cannot be established, do not stop unrelated services and do not mark the backup frozen/complete.
Record listener/process/writer evidence without command lines containing secrets.

- [ ] **Step 3: Create an external restricted backup parent**

```powershell
New-Item -ItemType Directory -Path 'C:\Users\Mohammad Amin Chezgi\GameVault-Backups' -Force
$backupPrincipal = [Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls.exe 'C:\Users\Mohammad Amin Chezgi\GameVault-Backups' /inheritance:r /grant:r "${backupPrincipal}:(OI)(CI)F"
```

Inspect ACL result and resolved path before copying. No operation targets a workspace/home root for deletion.
This local receipt uses operator-restricted storage. The production receipt additionally requires encrypted off-host backup and separately protected keys.

- [ ] **Step 4: Produce fresh backup/restore in new named directories**

```powershell
node scripts/migration/cli.cjs 'C:\Users\Mohammad Amin Chezgi\Downloads\بازی منیجر' 'C:\Users\Mohammad Amin Chezgi\GameVault-Backups\baseline-20260915' 'C:\Users\Mohammad Amin Chezgi\GameVault-Backups\restore-20260915'
```

If these named targets already exist, the CLI rejects them. Use a new explicit receipt-specific name; do not overwrite/delete an existing backup.

- [ ] **Step 5: Reinstall and verify the restored baseline**

```powershell
npm.cmd ci --prefix 'C:\Users\Mohammad Amin Chezgi\GameVault-Backups\restore-20260915'
npm.cmd ci --prefix 'C:\Users\Mohammad Amin Chezgi\GameVault-Backups\restore-20260915\theia'
```

Both package-lock.json files currently exist. Use these preserved locks; dependency reinstall failure means runtime restoration is incomplete.
Run `node scripts/run-contracts.js` from the restored root and compare the exact six known failing files with the original baseline.
Start the restored server with an unused loopback port through its existing PORT configuration, run the diagnostic baseline with `GV_AUDIT_BASE_URL` pointed at that port, then stop only the restored instance.
The restored server may rewrite its restored README as known A20; record that effect separately from byte-copy verification, never apply it to original backup files.
No HTTP probe reads/prints secret body values or starts a live terminal/Agent/build.

- [ ] **Step 6: Write the final private restore receipt**

Fields: source/destination resolved paths, frozen writer evidence, inventory digest, file/byte counts, dependency lock digests, copied/restored integrity outcomes, Node/tool versions, contract failure set, active-page status checks, known A20 side effects, unresolved candidates and runtimeVerified boolean.
`runtimeVerified=true` requires successful clean dependency reinstall and no additional baseline failures; `backupComplete=true` also requires verified frozen writers and zero unresolved in-scope preservation gaps.
Resume original services after the receipt. P01 product changes may start only when this gate is complete.

## Acceptance and rollback

Acceptance: raw binary/Unicode files preserved; no link traversal; source cannot change unnoticed during backup; actual frozen backup and independent runtime restoration have a complete receipt.
Rollback: resume original service and keep generated backups/receipts. This package never changes original product data or recursively deletes an existing directory.
Execution of this plan is a separate delivery; the scripts shown here are planned source, not files already deployed by writing this document.
