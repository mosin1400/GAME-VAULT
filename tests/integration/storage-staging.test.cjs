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
} = require("../../apps/api/dist/platform/storage-operations/local-store");

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-vault-staging-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("verified staging copies exact binary bytes below an operation-owned staging key", async (t) => {
  const root = await fixture(t);
  const sourceRoot = path.join(root, "source");
  const storageRoot = path.join(root, "storage");
  const bytes = Buffer.from([255, 0, 128, 3]);
  await fs.mkdir(path.join(sourceRoot, "assets"), { recursive: true });
  await fs.writeFile(path.join(sourceRoot, "assets", "hero.bin"), bytes);
  const manifest = await createSourceManifest(sourceRoot);

  const staged = await stageVerifiedManifest({
    sourceRoot,
    storageRoot,
    operationId: "d0e12fc9-2b31-49d0-8e15-61fad471f9bd",
    manifest,
  });

  assert.equal(staged.storageKey, "staging/d0e12fc9-2b31-49d0-8e15-61fad471f9bd");
  assert.deepEqual(
    await fs.readFile(path.join(storageRoot, "staging", "d0e12fc9-2b31-49d0-8e15-61fad471f9bd", "assets", "hero.bin")),
    bytes,
  );
});

test("staging rejects a source changed after its manifest and removes its owned temporary tree", async (t) => {
  const root = await fixture(t);
  const sourceRoot = path.join(root, "source");
  const storageRoot = path.join(root, "storage");
  const operationId = "c238feba-cc2a-4c47-b27e-21344f989038";
  await fs.mkdir(sourceRoot, { recursive: true });
  await fs.writeFile(path.join(sourceRoot, "game.bin"), Buffer.from([1]));
  const manifest = await createSourceManifest(sourceRoot);
  await fs.writeFile(path.join(sourceRoot, "game.bin"), Buffer.from([2]));

  await assert.rejects(
    stageVerifiedManifest({ sourceRoot, storageRoot, operationId, manifest }),
    (error) => error instanceof LocalStorageError && error.code === "SOURCE_CHANGED",
  );
  await assert.rejects(fs.access(path.join(storageRoot, "staging", operationId)));
});

test("staging rejects a manifest path that could escape its source tree", async (t) => {
  const root = await fixture(t);
  const sourceRoot = path.join(root, "source");
  await fs.mkdir(sourceRoot, { recursive: true });

  await assert.rejects(
    stageVerifiedManifest({
      sourceRoot,
      storageRoot: path.join(root, "storage"),
      operationId: "34d74a3d-c038-406a-b0d0-c704ec0a94dc",
      manifest: { files: [{ path: "../outside.bin", byteLength: 1, sha256: "a".repeat(64) }], sha256: "b".repeat(64) },
    }),
    (error) => error instanceof LocalStorageError && error.code === "INVALID_MANIFEST",
  );
});
