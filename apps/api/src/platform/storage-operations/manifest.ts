import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface ManifestFile {
  path: string;
  byteLength: number;
  sha256: string;
}

export interface SourceManifest {
  files: ManifestFile[];
  sha256: string;
}

export class StorageManifestError extends Error {
  constructor(readonly code: 'SOURCE_NOT_DIRECTORY' | 'SYMLINK_NOT_ALLOWED' | 'SPECIAL_FILE_NOT_ALLOWED') {
    super(code);
  }
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function manifestPath(root: string, file: string): string {
  const relative = path.relative(root, file);
  return relative.split(path.sep).join('/');
}

async function appendDirectory(root: string, directory: string, files: ManifestFile[]): Promise<void> {
  const entries: Dirent[] = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const status = await fs.lstat(fullPath);
    if (status.isSymbolicLink()) throw new StorageManifestError('SYMLINK_NOT_ALLOWED');
    if (status.isDirectory()) {
      await appendDirectory(root, fullPath, files);
      continue;
    }
    if (!status.isFile()) throw new StorageManifestError('SPECIAL_FILE_NOT_ALLOWED');

    const bytes = await fs.readFile(fullPath);
    files.push({
      path: manifestPath(root, fullPath),
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
    });
  }
}

/**
 * Reads a source tree as raw bytes. It deliberately returns no absolute path,
 * host metadata or decoded file content so callers can persist it safely.
 */
export async function createSourceManifest(root: string): Promise<SourceManifest> {
  const rootStatus = await fs.lstat(root);
  if (rootStatus.isSymbolicLink()) throw new StorageManifestError('SYMLINK_NOT_ALLOWED');
  if (!rootStatus.isDirectory()) throw new StorageManifestError('SOURCE_NOT_DIRECTORY');

  const files: ManifestFile[] = [];
  await appendDirectory(root, root, files);
  return { files, sha256: sha256(JSON.stringify(files)) };
}
