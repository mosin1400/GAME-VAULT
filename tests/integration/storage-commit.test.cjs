"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createSourceManifest } = require("../../apps/api/dist/platform/storage-operations/manifest");
const {
  LocalStorageError,
  stageVerifiedManifest,
  commitStagedSnapshot,
} = require("../../apps/api/dist/platform/storage-operations/local-store");

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-vault-commit-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("commit promotes only the verified staging tree to its immutable snapshot key", async (t) => {
  const root = await fixture(t);
  const sourceRoot = path.join(root, "source");
  const storageRoot = path.join(root, "storage");
  const operationId = "b997d1b5-8b0c-41bb-9cba-199b92ab51d8";
  const snapshotId = "23879ae4-67df-4f44-8cfe-f5f35f122b42";
  await fs.mkdir(sourceRoot, { recursive: true });
  await fs.writeFile(path.join(sourceRoot, "game.bin"), Buffer.from([9, 8, 7]));
  const manifest = await createSourceManifest(sourceRoot);
  await stageVerifiedManifest({ sourceRoot, storageRoot, operationId, manifest });

  const committed = await commitStagedSnapshot({ storageRoot, operationId, snapshotId, manifest });

  assert.equal(committed.storageKey, `snapshots/${snapshotId}`);
  assert.deepEqual(await fs.readFile(path.join(storageRoot, "snapshots", snapshotId, "game.bin")), Buffer.from([9, 8, 7]));
  await assert.rejects(fs.access(path.join(storageRoot, "staging", operationId)));
});

test("commit rejects tampered staging without destroying evidence or publishing a pointer", async (t) => {
  const root = await fixture(t);
  const sourceRoot = path.join(root, "source");
  const storageRoot = path.join(root, "storage");
  const operationId = "2ee3c4f7-6e81-4f5d-a533-378f0d43ded0";
  const snapshotId = "dd33d7c3-1bd2-4eb9-991e-9e6c490a94d5";
  await fs.mkdir(sourceRoot, { recursive: true });
  await fs.writeFile(path.join(sourceRoot, "game.bin"), Buffer.from([1]));
  const manifest = await createSourceManifest(sourceRoot);
  await stageVerifiedManifest({ sourceRoot, storageRoot, operationId, manifest });
  await fs.writeFile(path.join(storageRoot, "staging", operationId, "game.bin"), Buffer.from([2]));

  await assert.rejects(
    commitStagedSnapshot({ storageRoot, operationId, snapshotId, manifest }),
    (error) => error instanceof LocalStorageError && error.code === "STAGING_MISMATCH",
  );
  await fs.access(path.join(storageRoot, "staging", operationId, "game.bin"));
  await assert.rejects(fs.access(path.join(storageRoot, "snapshots", snapshotId)));
});
