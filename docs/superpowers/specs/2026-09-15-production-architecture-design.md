# Game Vault: معماری اصلاح‌شده برای استقرار چندکاربره

Date: 2026-09-15
Status: reviewable design; runtime redesign has not been implemented.
Scope: architecture, access, storage consistency, frontend, migration and delivery boundaries.

## 1. تصمیم و دلیل انتخاب

Target deployment: Linux control-plane VM + separate Linux execution-worker VM.
Control plane runs the API, web gateway and PostgreSQL. User code runs only on the worker.
Each workspace gets its own Theia process, sandbox, writable volume and resource limits.
The initial worker uses Docker with the `runsc` gVisor runtime. Kubernetes is excluded from the initial deployment.

Options considered:

| Approach | Benefit | Cost / reason for decision |
| --- | --- | --- |
| Modular monolith + dedicated sandbox worker | Clear domain transactions, incremental migration, execution isolated from account/data services | Selected; worker lifecycle and recovery must be implemented explicitly |
| Kubernetes services from day one | Scheduler and network-policy tooling | Adds cluster operations before workload size and operating capacity are established |
| One shared Theia process on the API host | Small local setup | Cannot provide the required separation of terminals, mounted files and host credentials |

Docker namespaces alone are insufficient as the only boundary for hostile workloads.
gVisor adds interception of the workload's system API; cgroups and external network controls still enforce resource and network policy.
This is a design decision informed by the [gVisor security model](https://gvisor.dev/docs/architecture_guide/security/), not a claim that a sandbox eliminates every host vulnerability.
The dedicated worker contains no database, OAuth, SMTP or AI-provider secrets.

## 2. فناوری با مسئولیت مشخص

| Choice | Responsibility | Reason |
| --- | --- | --- |
| TypeScript strict | New API, web and Game Vault extension source | Shared contracts and explicit error/state types |
| Node.js 24 LTS | New API/control services | Supported release line; current local Node is 24.19.0; see [Node release policy](https://nodejs.org/en/about/previous-releases) |
| Fastify 5 + JSON Schema / TypeBox | HTTP routing, schema validation, serialization, OpenAPI | Route encapsulation and request/response schemas; [official TypeScript support](https://fastify.dev/docs/latest/Reference/TypeScript/) |
| PostgreSQL 18 + `pg` + versioned SQL migrations | Identity, ACL, catalog, operations, jobs, durable events | Concurrent transactions, row locking, constraints, operational backups; [MVCC](https://www.postgresql.org/docs/current/mvcc-intro.html) |
| React 19 + Vite + React Router | Public and management web application | Route-based delivery; shared components; existing pages remain until their replacement passes behavior tests |
| TanStack Query 5 | Server state cache | Targeted invalidation after changes; [query invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) |
| React state/reducers + URL parameters | Form state, dialogs, filters and navigation | No additional global state framework initially; [React state guidance](https://react.dev/learn/managing-state) |
| Existing Theia application | IDE | Preserve its existing capability set and tests; package runtime compatibility is verified separately from the API's Node baseline |
| Docker + gVisor on worker | Workspace/command isolation | Per-workspace process and filesystem boundary; native PTY and language-server compatibility are a delivery gate |

Google login uses OpenID Connect; it does not require PostgreSQL.
SQLite can support multiuser applications. Its write-concurrency and deployment trade-offs differ; see [SQLite's own deployment guidance](https://www.sqlite.org/whentouse.html).
PostgreSQL is selected for this product's concurrent mutations, durable operation journal, pooled services and growth path.
Redis is not an initial dependency. Jobs use PostgreSQL leases; events use a durable outbox.
Adding Redis requires a measured problem and a separate decision record: queue throughput, shared ephemeral cache, or distributed throttling.
All package versions and container digests are pinned in the delivery that introduces them; production never installs wildcard dependencies.

## 3. مالکیت و مرز دسترسی

Every project has exactly one `owner_user_id`, an immutable project UUID, project members and a lifecycle state.
The owner is determined only by the project row. Members have `maintainer`, `developer` or `viewer` roles.
The owner's authority is not duplicated in a second member row.
Platform roles are independent: `user`, `moderator`, `system_admin`.
A system administrator manages users, quotas, runtime health and moderation; that role alone does not allow reading or editing private source.
Operator/root access is a trusted infrastructure capability, not an application role and not represented as ordinary project membership.

Published access is `public`, `unlisted` or `members`. Public/unlisted publication grants access to released playable bytes, not draft source or a terminal.
Unlisted means absent from discovery; its URL is not a confidentiality control.
Ownership transfer locks the project, validates an active verified recipient, updates the owner and old-owner membership atomically, increments the ACL epoch and writes an audit event.
Full matrix and constraints: [data and access model](2026-09-15-data-access-model.md).

## 4. مسئولیت ماژول‌ها

| Unit | Owns | May call | Must not do |
| --- | --- | --- | --- |
| identity | Users, passwords, sessions, email actions, external identities | Mail adapter, auth repository | Assign project access from email alone |
| projects | Ownership, members, metadata, visibility, quota | Identity lookup, policy evaluator | Write workspace content |
| versions | Stable version IDs, draft revisions, release state | Storage port, operation journal | Build paths from display labels |
| storage-operations | Staging, checksums, immutable snapshots, compensation, GC | Worker/storage adapters | Make a release public before its bytes are verified |
| studio | Workspace leases, launch/gateway scope, revocation | Policy evaluator, worker adapter | Execute a shell on the API host |
| agent | Conversations, proposals, approval lifecycle | Scoped file read and studio command ports | Receive server API keys in a workspace |
| builds | Jobs, worker capabilities, logs, artifacts | Immutable snapshot read, queue | Build directly from a changing live workspace |
| community | Ratings, comments, replies, activity | Publication policy, identity | Associate old anonymous data with a user by guessed identity |
| events | Durable outbox, recipient-filtered SSE | Domain events, current ACL | Broadcast private events to all clients |
| web | Routes, stateful forms, components, cache invalidation | Versioned public API | Own canonical catalog or account state in localStorage |

Each domain has `routes.ts`, `service.ts`, `repository.ts`, `policy.ts` only when that responsibility exists.
HTTP routes translate schemas/errors and call services. Repositories execute scoped SQL. Services own transaction decisions.
Shared `packages/contracts` contains schemas and wire types, not application state or a second domain implementation.
The application entry point assembles dependencies; it contains no route business logic.

Target organization:

```text
apps/api/src/modules/{identity,projects,versions,studio,agent,builds,community,events}/
apps/api/src/platform/{database,config,http,storage-operations}/
apps/web/src/{app,features,components}/
apps/worker/src/{supervisor,runtime,transfer,scanner}/
theia/gv-extension/src/{toolbar,workspace,agent,problems,theme}/
packages/contracts/src/
infrastructure/{database/migrations,gateway,worker,compose}/
storage/{projects,operations,quarantine}/
tests/{behavior,integration,security,migration}/
```

## 5. امنیت Theia، terminal و preview

The sandbox identity is `(workspace_id, user_id, project_id, version_id, lease_epoch)`.
Two members of the same project get separate working copies and terminals.
The first release does not provide collaborative editing inside a shared live directory.
Viewers can read authorized source through the API; they receive no executable Theia workspace.

Worker provisioning accepts a typed specification; caller-supplied image names, host paths, environment, mounts or arbitrary Docker arguments are rejected.
The trusted supervisor derives the mount from a registered workspace UUID, verifies it is not a link and owns the only runtime-control socket.
The socket is never mounted into Theia, API or build workloads.
The supervisor exposes narrow mTLS operations: provision, status, freeze/checkpoint, resume and stop.
It cannot be reached from sandbox networks.

Initial workspace profile:

| Property | Required value |
| --- | --- |
| runtime | `runsc`; failure to initialize stops provisioning |
| identity | non-root `10000:10000`; no sudo; all capabilities dropped; no-new-privileges |
| root filesystem | read-only; writable `/workspace`, private home and bounded tmpfs only |
| mounts | one workspace volume; no project parent, host home, `/proc` of host, devices or secrets |
| CPU / memory / processes | 2 CPU, 2 GiB RAM, swap disabled, 256 PIDs |
| disk / logs | 5 GiB project-quota-backed volume; tmpfs 128 MiB; rotating logs capped at 50 MiB |
| lifetime | 30-minute idle stop, 8-hour maximum lease; checkpoint before normal stop |
| network | no host networking; no direct inbound public port; no peer, control-plane, metadata or private-network access |
| dependencies | egress proxy allowing approved package registries; DNS only through controlled resolver; HTTPS rate/bandwidth limited |
| image | operator-built and digest-pinned; toolchain/version declaration recorded |

Resource availability is checked at boot and when admitting workspaces. cgroup limits must be effective, not just present in configuration.
The writable worker disk uses XFS project quotas (or an equivalently enforced per-volume quota) for the combined checkout/home allocation; Docker writable-layer limits alone do not limit a mounted volume.
The concrete initial deployment uses a dedicated XFS worker data disk with `prjquota`; provisioning verifies quota enforcement before admission.
See [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/) and [gVisor production guidance](https://gvisor.dev/docs/user_guide/production/).
Network isolation is enforced by worker firewall/egress gateway for all protocols, including IPv6 and direct IP access.
The default image contains approved extensions. User code and language-server hooks remain untrusted sandbox workloads.
No workload port is published with a public Docker port mapping; ingress is exclusively through the gateway on the private worker network.

Theia HTTP/WebSocket traffic passes through an authenticated gateway. The raw Theia port is private.
Each workspace has a separate host name on a studio domain separate from the account application.
Playable uploads and previews use a separate user-content origin without account or studio cookies.
The gateway strips cookies, authorization and internal headers before forwarding traffic to Theia.
IDE frontend requests use a workspace-scoped gateway API; no application bearer token is injected into the sandbox.

Launch flow:

1. App CSRF-protected POST creates/locates an authorized workspace and returns a nonsecret bootstrap URL.
2. Top-level studio bootstrap sets a 60-second host-only secure HttpOnly bootstrap cookie and records its hash/challenge.
3. It redirects to the app with workspace/challenge IDs. The app checks its authenticated session, current ACL and CSRF-protected launch request.
4. The app creates a 30-second single-use launch ticket bound to the challenge, user, app session, workspace and ACL epoch.
5. Browser submits the ticket in a POST body to the studio launch endpoint. Gateway checks the bootstrap cookie, Origin, session validity and binding; atomically consumes the ticket.
6. Gateway sets a host-only `__Host-gv_studio` secure HttpOnly cookie and sends 303 to a clean IDE URL. Tickets/cookies are redacted from logs.

The temporary bootstrap cookie is `SameSite=None` for the cross-origin POST; the normal studio cookie is `SameSite=Lax`.
The persistent token never appears in URL/history/referrer.
Every gateway API call checks current membership, session and lease epoch. WebSockets revalidate every five seconds and close when revoked; the worker is then stopped.
No raw `/api/terminal` route executes on the control plane. Interactive terminal runs inside the sandbox.
Agent command approval controls user intent; sandboxing controls operating-system access. Both are required.
Git/statistics/project-tools use the same scoped workspace ports. Local VS Code launch stays a local-profile capability; the server profile provides authorized source export or a separately supported remote connection, never a host-application launch or leaked physical host path.

## 6. منبع حقیقت و تغییر مستقیم فایل

| Information | Authority | File behavior |
| --- | --- | --- |
| Project ownership, membership, visibility, metadata | PostgreSQL | Not derived from an uploaded manifest |
| Version ID, label, revision, published pointer | PostgreSQL | Physical keys use UUIDs; label changes do not move data |
| Source/assets | Immutable snapshot bytes + private working-copy bytes | DB stores snapshot references and hashes |
| Ratings/comments/favorites/sessions | PostgreSQL | Export/import formats are transport only |
| `game.json` | Generated projection, with `schemaVersion`, `exportedMetadataRevision`, IDs and provenance | Direct changes produce a proposal; do not update canonical metadata automatically |
| `README.md` | User-authored source | Preserve as bytes; generated system information uses a separate managed export |
| `project.config.json` | Versioned source configuration for entry point/toolchain | Validate during checkpoint/build; never grants account, filesystem or execution privileges |

A trusted scanner outside the sandbox observes saved bytes and reports hashes/dirty state.
Checkpoint freezes all sandbox writers before scanning; the scanner rejects links/special files and checks file identity/size before and after hashing. An unstable file aborts the checkpoint and preserves the working copy.
Unsaved editor buffers remain local to Theia and are not claimed to be synchronized.
Saved source becomes canonical only after a checkpoint with `expectedDraftRevision`.
There is one active working copy per user/version; different users' checkpoints use compare-and-swap.
First successful checkpoint advances the revision. A stale checkpoint gets 409 with base/current/proposed snapshot IDs; its private copy is retained for explicit merge.
There is no last-writer-wins overwrite of canonical source.

Changed `game.json` bytes are kept in a metadata proposal with their source hash and base revision.
Only title, description, category, AI attribution and a project-owned cover-asset reference are importable.
IDs, owner, roles, status, rating, URLs, quotas and publication pointers are rejected fields.
Applying a proposal requires `metadata.write`, schema validation and matching metadata revision.
Failure leaves the proposal visible for correction. Checkpoints regenerate the managed manifest from the accepted DB values and preserve the proposal separately.
Metadata changes are private draft changes. Public metadata is the DB release record frozen at publication; drafts do not leak into the public dashboard.
Historical package manifests remain frozen exports, with their export revision recorded.

## 7. قرارداد دیتابیس و فایل‌ها

Filesystem writes do not participate in SQL transactions. Consistency comes from a durable operation journal, immutable objects, idempotency and fencing.
Storage layout:

```text
projects/<projectId>/versions/<versionId>/snapshots/<snapshotId>/
projects/<projectId>/blobs/<sha256>/
workspaces/<workspaceId>/checkout/
operations/<operationId>/stage/
```

Object keys are internal IDs, never supplied display labels or slugs.
Source snapshots include byte length, SHA-256, normalized relative path and media type.
No UTF-8 conversion is used for binary preservation. Symbolic/hard links and special files are rejected at import/checkpoint.

Operation lifecycle: `planned -> staging -> bytes_ready -> committed` or `conflict/aborted/failed`.
`operations` records actor, project, expected revisions, lease/fence, staging key, verified manifest, attempts and error code.
An API request returns 202 and operation ID for cross-system operations; only committed state means canonical completion.

| Action | Durable sequence | Recovery |
| --- | --- | --- |
| Rename version label | SQL revision-checked update + audit/outbox | Transaction rollback; no filesystem mutation |
| Checkpoint | Persist operation; freeze sandbox; upload and verify snapshot; commit new DB pointer with expected revision | Retry same operation; preserve staged bytes on conflict; leave old pointer readable |
| Publish | Capture accepted metadata/source revisions; materialize immutable release bytes; verify; final SQL CAS on published pointer + audit/outbox | Uncommitted bytes stay private; retry if preconditions still hold; otherwise mark conflict |
| Restore history | Verify selected snapshot; create a new revision using checkpoint pipeline | Existing pointer remains until success; no recursive delete of current project |
| Delete project | SQL tombstone + increment ACL/operation fences + outbox; revoke gateways; stop workspaces/jobs; retained bytes | Resume deletion worker; owner may restore within 30 days; restore does not revive old sessions |
| Create/import project | Stage all upload parts; validate entry point/assets; register rows and references | Incomplete stage expires after 24 hours; no visible half-created public project |

If byte promotion succeeds and the final SQL commit fails, the operation keeps its immutable staging/object references.
Reconciler checks hashes and state, reacquires the lease and retries the final transaction; if revisions/ACL changed, it marks conflict and retains/quarantines the objects.
It does not infer publication merely because a directory exists.
Concurrent publish uses `expectedPublishedRevision`: only one request can change the public pointer from the same base.
GC uses project-scoped references and backup/retention eligibility; it never deletes a referenced shared snapshot/blob.
Detailed procedures: [migration and recovery](2026-09-15-migration-recovery.md).

## 8. رابط و همگام‌سازی

Public routes: catalog, game/release detail, favorites, recent, login/register/verify/reset, profile/security.
Management routes: my projects, project overview, versions, members, metadata, history, agent activity, builds.
System routes: user moderation, quotas, worker/operation health and audit, protected by platform permissions.
Theia has its own frontend lifecycle and shares API contracts, theme tokens and domain events, not React application state.

Common components: app shell, project/release card, filter bar, skeleton, empty state, error/retry panel, permission panel, form-field errors, upload progress, operation status, member selector and confirmation dialog.
Server cache keys include user/project/version identity. Logout/account switch clears private caches and closes SSE.
Form state remains in React state/reducers; background refetch never resets a dirty form.
Search/filter/tab are URL state. Theme is a local preference mirrored to the account after authentication, not account identity.

Domain mutations commit an outbox event in their SQL transaction.
SSE `/api/v1/events` sends authorized event envelopes containing ID, type, resource IDs and revision, not full private files or tokens.
Anonymous `scope=public` subscribers receive only released-catalog events for currently public releases; no source, membership, workspace, unlisted-discovery or draft events.
Gateway routes studio events through its scoped endpoint. Dashboard/management query caches invalidate the affected resource.
Theia refreshes version/metadata/permission status while preserving open buffers.
Clients de-duplicate event IDs, reconnect with Last-Event-ID and refetch on an expired cursor; delivery is at least once.
PostgreSQL notifications may wake consumers but are never the durable source.
After reconnect/focus, clients also refetch. Metrics may use a separate explicit refresh interval; no five-second whole-page rerender loop.

Every route defines five conditions:

| Condition | Behavior |
| --- | --- |
| loading | skeleton for initial read; scoped progress for mutation; preserve already loaded content |
| empty | explain the condition and offer the authorized next action |
| error | stable error code, useful retry, retain form/upload state; no stale static catalog substitution |
| permission | 401 offers login with a validated relative return path; 403 explains unavailable action; unauthorized private IDs return 404 |
| mobile | 360px minimum layout, drawer navigation, stacked cards/forms; wide source/IDE offers deliberate full-screen view and never hides unsaved-work status |

More specific page-state acceptance criteria are in the delivery plan.

## 9. حساب‌ها

Accounts include registration, email verification, reset, session management and explicit external-identity linking.
Public browsing works without an account. Creating projects, execution, member invitations and publishing require a verified active account.
Existing local admin becomes an explicitly mapped bootstrap owner; the embedded shared password is not carried into production.
Password/session/email/OAuth policy is specified in [the data/access model](2026-09-15-data-access-model.md).
Google is a later isolated delivery: provider identity is `(issuer, subject)`, with explicit linking and reauthentication.
Rate-limit identity uses the verified gateway address chain; untrusted client Forwarded/X-Forwarded-For headers do not override it.
Agent context excludes project `.env`, credential/key files and ignored dependency/build trees by default; intentionally sharing a project-owned secret requires an explicit scoped user action, never automatic context collection.

## 10. معیار تحویل و ترتیب

Each package has a goal, exact files, interfaces, dependencies, behavioral tests, acceptance and rollback.
Framework migration, database migration and activation of accounts are separate packages and route switches.
Inventory and a verified restore are required before changing product data.
The existing Theia tests remain; failures caused by removed legacy references are cleaned up without replacing them with another editor test.
When P09 changes the gateway contract, existing assertions requiring host file URIs/query credentials are updated in those tests while preserving theme, toolbar, chat and capability behavior coverage.
The audit distinguishes behavioral confirmations, source-confirmed defects, unverified risks, deliberate local limitations and deletion regressions.

Critical end-to-end journeys:

1. Register, verify email, login, create a private project and invite a member.
2. Owner/developer open separate studios; neither can reach another project or host secrets.
3. Both save/checkpoint from the same base; stale second writer receives a recoverable conflict.
4. Publish verified bytes; public detail/play/download and management show the same released IDs.
5. Change a label without moving storage; existing release links remain usable.
6. Revoke a member/session while Theia is open; API denies immediately and sockets close within five seconds.
7. Restore a historical binary asset and confirm its hash; active source is never deleted before replacement is ready.
8. Interrupt a storage operation between byte promotion and SQL commit; recover to old or new committed state without partial publication.
9. Migrate the actual local dataset twice with the same mapping; counts and checksums do not change.
10. Roll back a cutover with captured new writes; no user data disappears into an old JSON-only service.

Linked outputs:

- [Data/access model](2026-09-15-data-access-model.md)
- [Migration/recovery map](2026-09-15-migration-recovery.md)
- [Revalidated audit](2026-09-15-validated-audit.md)
- [Delivery program](../plans/2026-09-15-production-delivery-program.md)

This design replaces earlier architecture recommendations where they conflict. It does not claim the planned runtime is already deployed or the observed defects already fixed.
