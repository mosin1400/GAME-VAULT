# Game Vault: نقشهٔ مهاجرت، backup و بازیابی

Date: 2026-09-15. Status: migration contract; no product-data import, backup or cutover has been performed in this documentation revision.
The diagnostic script uses disposable fixture files and removes only its verified temporary directory.

## 1. Current dataset and uncertainty

Live inventory at directory level: 11 project directories; only `t34-steel-front` has recognized versions (`2`, `v1.1.0`).
The ten other directories contain varied application source, including TypeScript/Vite applications and automation packages.
Their lack of `game.html` at the root does not prove they are empty or broken games.
They need import classification and entry-point/toolchain recognition; do not fabricate `game.json` and call them migrated.
The catalog currently exposes one game. Both existing version manifests point to a missing `v1.0.0` playable path.

Operational data exists in `.vault`: admin profile, users, community, agent conversations and per-project history.
Local preferences exist only in users' browsers and cannot be inventoried from the server filesystem.
`data/games.json` is a legacy listing, not an ownership or version authority.
The legacy editor was deleted before this plan. A backup of the current tree cannot recover pre-deletion files; no pre-deletion restore point is claimed.

## 2. Inventory schema and scope

Inventory is created before source/data migration. Discovery reads metadata and bytes; it executes no uploaded `package.json` scripts, Dockerfiles or project commands.

```ts
interface InventoryFile {
  path: string;
  kind: 'file'|'directory'|'link'|'special'|'excluded';
  bytes?: number;
  sha256?: string;
  mode?: number;
  migrationClass: 'preserve'|'generated'|'quarantine'|'protected';
}
interface Inventory {
  schemaVersion: 1;
  sourceRoot: string;
  entries: InventoryFile[];
}
interface MigrationClassification {
  inventoryHash: string;
  createdAt: string;
  projectCandidates: { sourceKey:string; format:string; entryPoint:string|null; decision:'import'|'preserve'|'quarantine'; reason:string }[];
}
```

Scope: application source/configuration, games, assets, `.vault`, data, uploads, builds, Theia lockfiles/source and generated runtime artifacts needed for restoration.
Dependency folders are explicitly classified as generated; pin/record their lockfiles and verify clean reinstall before calling an application backup restorable.
User constraint (2026-09-15): environment files are never opened, hashed, copied or included in restore. Exclusion is case-insensitive and applies to every path segment (`.ENV`, `.env.*`, `*.env`, including examples). Protected directories are not traversed. Inventory records only the excluded relative name, without byte length/hash. This overrides the earlier secret-copy proposal.
The receipt states `secretsIncluded:false`. This is an application/data backup, NOT a complete production credential recovery set. The operator must separately provision credentials; this task must not retrieve them.
Published evidence omits sensitive identity content; private backup manifests remain restricted.
Links and special files are recorded, not dereferenced or copied as ordinary files.
Paths use normalized relative names and retain original Unicode filenames, including spaces, parentheses and casing.
Backup destination must be an explicit absolute directory outside the workspace; validate resolved paths and reject any link/reparse-point ancestor before copying.

## 3. Backup gate

Before any product-data mutation:

1. Inventory all in-scope files and potential storage outside the workspace; report counts/bytes/classes and unresolved imports.
2. Stop/freeze writes: current HTTP server, Theia, agent/build jobs and any process editing the data directories. Verify no active writers remain.
3. Produce a fresh frozen inventory; do not use an inventory captured while files were changing.
4. Copy source and operational bytes to a new restricted external backup directory. Never convert source/binary bytes through UTF-8 JSON.
5. Hash every copied file and compare its byte length/hash with the frozen inventory. Hash consistency does not prove application start-up; both are tested.
6. Restore to a separate empty directory, reinstall pinned dependencies and run baseline tests/HTTP checks on an unused loopback port.
7. Record a backup receipt containing location, inventory digest, verification outcome, restore checks, timestamp and baseline exceptions.
8. Resume the original service or begin the authorized maintenance switch only after the receipt is complete.

The baseline is already imperfect: six existing contract tests fail. A baseline restore should reproduce that known set without additional failures; it must not be mislabeled as 100% passing.
For production PostgreSQL, add a consistent database backup/PITR policy and an application write-watermark/outbox sequence to the receipt.
File backup and DB backup must refer to the same maintenance epoch; arbitrary independently timed copies are not a valid restore set.
Minimum production policy: daily encrypted backup, 30-day retention, separate backup access, monthly restore drill, target RPO <=24h/RTO <=4h for the initial deployment.
Measure recovery times before promising these targets. Higher availability gets a separate budget/capacity decision.

## 4. Explicit mapping

`migration-manifest.json` fixes IDs and ownership before importing. Its schema is:

```ts
interface MigrationManifest {
  schemaVersion: 1;
  inventoryHash: string;
  defaultOwnerSourceKey: 'admin-local';
  defaultOwnerId: string;
  projects: {
    sourceKey: string;
    projectId: string;
    versionSources: { sourceKey:string; versionId:string; label:string }[];
    publication: 'members';
  }[];
  unresolvedPolicy: 'quarantine';
}
```

Actual IDs/hashes are generated, stored and reviewed in P00/P06. For the current t34 input, version source keys are `versions/2` and `versions/v1.1.0`; publication initially stays member-only until validation/publish.
Every resolved source namespace/key has exactly one fixed target UUID in `legacy_mappings`.
Importing twice with the same inventory/mapping is idempotent. Changed input under the same source key gets a new migration run and explicit conflict report.
Existing projects map to a verified bootstrap owner's UUID. No ownership is inferred from filenames, readme author strings or public metadata.
Imported accounts with historical password hashes are tagged for reset; the embedded shared admin password is not reused in production.

## 5. Dataset migration rules

| Input | Destination / conversion | Acceptance / unresolved handling |
| --- | --- | --- |
| Existing t34 versions `2`, `v1.1.0` | Separate stable version UUIDs and immutable byte snapshots; preserve current labels | Entry point and all assets verified; invalid legacy URLs replaced by ID-based generated release URLs |
| Ten nonversioned projects | Import candidate with detected format; one draft version only after valid source-root/entry-point decision | Preserve exact original tree; unsupported automation/backend projects remain quarantined/importable, not public playable games |
| Vite/React source | Source snapshot + approved build profile; built output becomes release artifact | No project install hook runs on control plane; sandbox build required before play |
| Assets/uploads | Binary blobs, asset references and snapshot manifest | SHA-256 and length equality; retain originals; missing references become explicit errors |
| `.vault/users.json` | Explicit legacy identities with reset state, no session migration | Validate schema, duplicated email/identity conflicts quarantined; never print hash/password records |
| `.vault/admin-profile.json` | Bootstrap user's display profile | Assign no additional permissions from profile data |
| `.vault/community.json` | Comments/replies, ratings, activity | Preserve legacy IDs/authors and unknown guest identity; counts/reply tree/timestamps compared |
| `.vault/agent-conversations` | Per-project/version conversations/messages using fixed mappings | Unknown project/version keys retained in quarantine; retain message order and IDs where valid |
| Per-project history | Legacy history records + recoverable textual snapshots | Mark `legacy-text-partial`; do not claim binary completeness or safe full restore |
| Build job/artifact state | Verified artifacts and terminal job records | Interrupted jobs become `interrupted`, not silently running/successful |
| `data/games.json` | Reference/reconciliation input only | Disagreement with actual source is reported; never becomes canonical DB catalog |
| Browser favorites/recents | User-visible local preference import after authenticated consent | Server cannot access arbitrary browser localStorage; preserve unresolvable IDs locally and report mappings |

Old history can already have lost bytes: replacement characters from UTF-8 conversion and omitted >=1MB files cannot be reconstructed.
Keep the original history JSON untouched in the backup and store its limitations in import provenance.
Restoring a legacy partial snapshot requires a preview and preserves unspecified current files; it never deletes a complete current tree.
New snapshots capture every accepted file as bytes; oversize/quota-limit errors reject the checkpoint explicitly instead of silently skipping files.

Local preference import parses JSON defensively, validates arrays/limits/types, maps legacy IDs and posts an idempotent import request.
Favorites merge by union; recent entries with known timestamps merge by latest timestamp.
Legacy order-only recents retain order/provenance without inventing accurate historical play times.
Local data is not cleared until the server acknowledges the import. Logging out clears account caches but not unimported guest preferences.

## 6. Dry-run and comparison

Dry-run operates on a backup/restored copy and an isolated PostgreSQL database.
It writes new storage namespaces only; the original `games` and `.vault` trees remain unchanged.
Reconciliation includes project/version counts, detected formats, unresolved entries, comments/replies/votes, message order, artifact counts and every preserved file's hash/size.
Validation produces a per-source outcome: `imported`, `preserved`, `quarantined` or `rejected`, with reason and target ID.
No candidate disappears merely because it was not recognized as a playable game.
Run twice; assert mapping/row counts and snapshot hashes stable.
Run with interrupted copy, missing image, malformed metadata and duplicate label; verify old data remains usable and report is actionable.

## 7. Cross-system recovery mechanics

The operation row exists before staging starts. Retry uses operation UUID and request hash.
Worker/storage APIs receive the same operation ID/fence and never accept an arbitrary destination path.
After upload, verify manifest hash and every file hash before `bytes_ready`.
On a local filesystem, promotion is an atomic rename on the same filesystem with required durability sync; cross-filesystem promotion uses copy-verify and a durable completion marker.
Future object storage uses immutable object keys plus a verified manifest/commit marker, never a directory rename assumption.

Reconciler scans unfinished operations on startup and periodically:

| Observed state | Action |
| --- | --- |
| planned/staging, no verified bytes | Resume transfer or mark failed after bounded retries; previous pointer stays active |
| bytes_ready, final SQL not committed | Reverify bytes, actor permission, expected revision and fence; retry commit |
| bytes_ready with stale revision/revoked permission | Mark conflict/aborted; retain private candidate for recovery for seven days |
| SQL committed, response/outbox delivery lost | Return the committed receipt for same idempotency key; outbox can be replayed |
| orphan bytes with known operation | Apply operation policy; never register/publish from filesystem existence alone |
| orphan bytes with no operation | Quarantine for seven days and report; do not guess owner/version |
| project deleting, worker still running | Gateway remains revoked; repeat stop; deletion state remains pending until acknowledged |

No maximum-retry handler recursively deletes canonical active source.
GC first marks eligible objects, then verifies absence of DB references/retention protection before removing only explicit keys.
Version label rename is entirely SQL and has no compensation step involving paths.

## 8. Cutover and rollback

Feature switches are route/domain based: `identity_v1`, `catalog_v1`, `management_v1`, `studio_v1`, `agent_v1`, `builds_v1`.
A domain has exactly one write owner. A compatibility adapter calls that owner; it does not independently dual-write JSON and PostgreSQL.
Begin with shadow reads against imported data; compare without exposing private fields in reports.
Switch one route/domain after behavioral acceptance, with write freeze for the final migration delta.
Old public URLs get explicit legacy-mapping redirects to valid release IDs; nonexistent versions do not receive fabricated workspace paths.

Rollback before write activation: disable the route switch and retain new imported namespaces for inspection.
Rollback after activation: first freeze new writes and save the operation/outbox watermark and verified DB/file backup.
Prefer the previous application version that still uses the new data model.
Return to the JSON application only when a tested reverse-export covers every new write; features unsupported by the old format remain in maintenance until restored to a compatible service.
Never simply discard new accounts, membership, versions, preferences or votes by re-pointing at an old directory.
Database migrations use expand/contract changes. Destructive column/table drops wait until the rollback window ends and a verified backup exists.
No new production-data migration relies on a rollback SQL script that cannot reconstruct removed bytes/values.

## 9. Delivery evidence

Required receipts: inventory manifest, backup/restore verification, source-to-target map, dry-run reconciliation, two-pass idempotence report, fault-injection report, cutover watermark, rollback rehearsal.
P00 produces the first two receipts before data-changing deliveries.
P06 produces import/reconciliation receipts; P12 rehearses and performs controlled activation.
Detailed dependency/acceptance/rollback for all packages: [delivery program](../plans/2026-09-15-production-delivery-program.md).
