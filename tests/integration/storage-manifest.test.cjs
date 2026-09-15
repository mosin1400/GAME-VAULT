"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  StorageManifestError,
  createSourceManifest,
} = require("../../apps/api/dist/platform/storage-operations/manifest");

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-vault-manifest-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("binary manifest preserves byte sizes and SHA-256 for nested Unicode files", async (t) => {
  const root = await fixture(t);
  const bytes = Buffer.from([0, 255, 1, 128, 67]);
  await fs.mkdir(path.join(root, "assets", "تصویر"), { recursive: true });
  await fs.writeFile(path.join(root, "assets", "تصویر", "café.bin"), bytes);

  const manifest = await createSourceManifest(root);

  assert.deepEqual(manifest.files, [{
    path: "assets/تصویر/café.bin",
    byteLength: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  }]);
  assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
});

test("manifest rejects directory links instead of following content outside its source root", async (t) => {
  const root = await fixture(t);
  const external = await fixture(t);
  await fs.writeFile(path.join(external, "outside.txt"), "outside");
  await fs.symlink(external, path.join(root, "linked"), process.platform === "win32" ? "junction" : "dir");

  await assert.rejects(
    createSourceManifest(root),
    (error) => error instanceof StorageManifestError && error.code === "SYMLINK_NOT_ALLOWED",
  );
});
