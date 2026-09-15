import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createSourceManifest, type SourceManifest } from './manifest';

export interface StageVerifiedManifestRequest {
  sourceRoot: string;
  storageRoot: string;
  operationId: string;
  manifest: SourceManifest;
}

export interface StagedSnapshot {
  storageKey: string;
  manifest: SourceManifest;
}

export interface CommitStagedSnapshotRequest {
  storageRoot: string;
  operationId: string;
  snapshotId: string;
  manifest: SourceManifest;
}

export class LocalStorageError extends Error {
  constructor(readonly code: 'INVALID_MANIFEST' | 'SOURCE_CHANGED' | 'STAGING_ALREADY_EXISTS' | 'STAGING_MISMATCH' | 'SNAPSHOT_ALREADY_EXISTS') {
    super(code);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function safeParts(relativePath: string): string[] | null {
  if (!relativePath || relativePath.includes('\\') || path.posix.isAbsolute(relativePath)) return null;
  const parts = relativePath.split('/');
  return parts.every(part => part !== '' && part !== '.' && part !== '..') ? parts : null;
}

function assertManifest(manifest: SourceManifest): void {
  if (!Array.isArray(manifest.files) || !SHA256.test(manifest.sha256)) throw new LocalStorageError('INVALID_MANIFEST');
  const paths = new Set<string>();
  for (const file of manifest.files) {
    if (
      !safeParts(file.path)
      || !Number.isSafeInteger(file.byteLength)
      || file.byteLength < 0
      || !SHA256.test(file.sha256)
      || paths.has(file.path)
    ) {
      throw new LocalStorageError('INVALID_MANIFEST');
    }
    paths.add(file.path);
  }
  if (sha256(JSON.stringify(manifest.files)) !== manifest.sha256) throw new LocalStorageError('INVALID_MANIFEST');
}

async function readVerifiedSourceFile(sourceRoot: string, relativePath: string): Promise<Buffer> {
  const parts = safeParts(relativePath);
  if (!parts) throw new LocalStorageError('INVALID_MANIFEST');

  let current = sourceRoot;
  const rootStatus = await fs.lstat(current);
  if (!rootStatus.isDirectory() || rootStatus.isSymbolicLink()) throw new LocalStorageError('SOURCE_CHANGED');

  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const status = await fs.lstat(current);
    if (status.isSymbolicLink()) throw new LocalStorageError('SOURCE_CHANGED');
    if (index < parts.length - 1 && !status.isDirectory()) throw new LocalStorageError('SOURCE_CHANGED');
    if (index === parts.length - 1 && !status.isFile()) throw new LocalStorageError('SOURCE_CHANGED');
  }
  return fs.readFile(current);
}

/**
 * Copies a known manifest into an operation-owned staging directory. No caller
 * receives the host path; only a scoped storage key is returned. Final publish
 * remains a separate transaction/pointer operation.
 */
export async function stageVerifiedManifest(request: StageVerifiedManifestRequest): Promise<StagedSnapshot> {
  assertManifest(request.manifest);
  if (!UUID.test(request.operationId)) throw new LocalStorageError('INVALID_MANIFEST');

  const storageKey = `staging/${request.operationId}`;
  const stagingPath = path.join(request.storageRoot, 'staging', request.operationId);
  await fs.mkdir(path.dirname(stagingPath), { recursive: true });
  try {
    await fs.mkdir(stagingPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new LocalStorageError('STAGING_ALREADY_EXISTS');
    throw error;
  }

  try {
    for (const file of request.manifest.files) {
      const bytes = await readVerifiedSourceFile(request.sourceRoot, file.path);
      if (bytes.byteLength !== file.byteLength || sha256(bytes) !== file.sha256) throw new LocalStorageError('SOURCE_CHANGED');

      const destination = path.join(stagingPath, ...safeParts(file.path)!);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, bytes, { flag: 'wx' });
      const storedBytes = await fs.readFile(destination);
      if (storedBytes.byteLength !== file.byteLength || sha256(storedBytes) !== file.sha256) throw new LocalStorageError('SOURCE_CHANGED');
    }
    return { storageKey, manifest: request.manifest };
  } catch (error) {
    await fs.rm(stagingPath, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Promotes only a staging tree whose freshly read manifest is identical to the
 * expected immutable manifest. On mismatch the staging tree is left intact for
 * the reconciler; an incomplete tree must never become a snapshot.
 */
export async function commitStagedSnapshot(request: CommitStagedSnapshotRequest): Promise<StagedSnapshot> {
  assertManifest(request.manifest);
  if (!UUID.test(request.operationId) || !UUID.test(request.snapshotId)) throw new LocalStorageError('INVALID_MANIFEST');

  const stagingPath = path.join(request.storageRoot, 'staging', request.operationId);
  const snapshotPath = path.join(request.storageRoot, 'snapshots', request.snapshotId);
  let stagedManifest: SourceManifest;
  try {
    stagedManifest = await createSourceManifest(stagingPath);
  } catch {
    throw new LocalStorageError('STAGING_MISMATCH');
  }
  if (stagedManifest.sha256 !== request.manifest.sha256) throw new LocalStorageError('STAGING_MISMATCH');

  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  try {
    await fs.lstat(snapshotPath);
    throw new LocalStorageError('SNAPSHOT_ALREADY_EXISTS');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await fs.rename(stagingPath, snapshotPath);
  return { storageKey: `snapshots/${request.snapshotId}`, manifest: request.manifest };
}
