# Game Vault: مدل داده، هویت و دسترسی

Date: 2026-09-15. Status: proposed contract for staged implementation.
Companion: [architecture](2026-09-15-production-architecture-design.md).

## 1. Identity and lifecycle

All domain IDs are server-generated UUIDs. Relative display labels and legacy slugs are not storage keys.
All timestamps are `timestamptz`; API timestamps are UTC ISO-8601.
Ownership, permissions and lifecycle are evaluated together; deleted/suspended resources cannot be authorized by a cached role.

| Entity | Key fields / constraints | Responsibility |
| --- | --- | --- |
| users | id; normalized_email unique; display_name; status `pending/active/suspended/deleted`; email_verified_at; auth_epoch | Account identity and revocation |
| password_credentials | user_id PK/FK; argon2_hash; changed_at; must_reset | Password verifier only; never returned by API |
| external_identities | id; user_id; issuer; subject; provider; unique(issuer,subject); linked_at | Stable external account identity, independent of email |
| platform_roles | (user_id, role) PK; role `moderator/system_admin` | Global capabilities; ordinary users need no elevated row |
| user_quotas | user_id PK/FK; max_projects; max_active_workspaces; max_storage_bytes; max_concurrent_builds; revision | Operator-configured admission/storage limits |
| sessions | id; user_id; token_hash unique; created_at; last_seen_at; idle_expires_at; absolute_expires_at; revoked_at; auth_epoch; device_label | Persistent per-device sessions |
| email_actions | id; user_id; purpose `verify/reset/change_email`; token_hash unique; expires_at; consumed_at; target_email | Single-use email actions |
| oauth_flows | id; purpose `login/link`; initiating_user/session; state_hash; nonce_hash; encrypted_pkce_verifier; expires_at; consumed_at | Browser/provider flow binding |
| auth_attempt_buckets | purpose; hashed IP/email bucket; window_start; count; expires_at | Initial shared throttling in PostgreSQL |
| mail_deliveries | id; action_id; status; attempts; next_attempt_at; provider_message_id | Retryable delivery without holding an HTTP transaction open |

Email normalization trims surrounding whitespace and case-folds for the product's uniqueness policy; it does not remove dots or plus suffixes.
Username aliases are optional display/legacy identifiers, not the account primary key.
No application-wide hardcoded password and no password normalization that silently changes characters in new accounts.
Existing Persian-digit normalization is retained only within an explicitly tagged legacy-password migration adapter.

## 2. Project and source model

| Entity | Key fields / constraints | Responsibility |
| --- | --- | --- |
| projects | id; owner_user_id NOT NULL FK; slug unique; title; description; category; ai_attribution; cover_asset_id; metadata_revision; publication_visibility `public/unlisted/members`; status `active/deleting/deleted`; acl_epoch; published_release_id; published_revision; deleted_at | Canonical project metadata, ownership and current public pointer |
| project_members | (project_id,user_id) PK; role `maintainer/developer/viewer`; created_at | Non-owner membership; service prevents inserting owner as member |
| project_invitations | id; project_id; invited_email; role; token_hash; expires_at; accepted_by; consumed_at | Seven-day single-use invitation; acceptance requires verified matching email and login |
| versions | id; project_id; label; state `draft/published/archived`; revision; draft_snapshot_id; unique(project_id,label) | Stable content branch/version identity |
| snapshots | id; project_id; version_id; manifest_hash; operation_id unique; created_by; created_at; verified_at | Immutable canonical source revision |
| snapshot_files | (snapshot_id,relative_path) PK; blob_id; sha256; byte_length; media_type | Binary-safe file manifest |
| blobs | id; project_id; sha256; byte_length; storage_key unique; unique(project_id,sha256,byte_length) | Project-scoped content-addressed bytes |
| assets | id; project_id; blob_id; original_name; media_type; purpose | Cover/source upload references; visibility follows authorized publication |
| releases | id; project_id; version_id; snapshot_id; metadata_revision; metadata_payload; version_label_at_release; artifact_key; artifact_hash; created_by; created_at; revoked_at | Immutable publication facts and frozen DB metadata |
| metadata_proposals | id; project_id; version_id; workspace_id; base_metadata_revision; file_hash; submitted_payload; normalized_allowed_patch; status; applied_revision | Untrusted manifest edits awaiting explicit permission-checked acceptance |
| legacy_mappings | (source_namespace,source_key) PK; entity_type; target_id; inventory_hash; migration_run_id | Repeatable migration identity, never inferred from display label |

Foreign keys include project association: version/snapshot/release cannot refer to a different project.
The published release must belong to the project and use a verified snapshot.
Only the owner can transfer ownership or request permanent deletion. Label changes increment a version's revision but never move storage.
Initial account profile: ten projects, two active workspaces, 20 GiB canonical storage and one concurrent build; system admin may change this versioned policy.
Canonical blob storage is charged to the project owner once per project-scoped blob. Live workspace quota is charged to its executing user and also has the fixed 5 GiB volume ceiling.
Quota admission/updates use locked quota rows and transactions, not UI-only counters. Ownership transfer checks the recipient's resulting project/storage quota before commit.
Published source is immutable. Editing it creates a new draft version UUID from the released snapshot.
Renaming a published version changes the current DB label; its historical release label/export remains frozen and explicitly labeled as historical.
Public queries use frozen release metadata; member queries use current project metadata. These are different lifecycle scopes, not interchangeable copies.

## 3. Operations and execution

| Entity | Key fields / constraints | Responsibility |
| --- | --- | --- |
| operations | id; project_id; kind; actor_id; idempotency_key; request_hash; state; expected_revisions; fence; staging_key; verified_manifest; attempts; error_code; lease_owner; lease_until; unique(actor_id,kind,idempotency_key) | Durable cross-system mutation journal |
| workspaces | id; user_id; project_id; version_id; state; base_revision; base_snapshot_id; dirty_manifest_hash; lease_epoch; acl_epoch; worker_id; lease_until; unique active(user_id,version_id) | Private live checkout, never the public source pointer |
| studio_launch_challenges | id; workspace_id; bootstrap_cookie_hash; expires_at; consumed_at | Binding of the studio browser to a launch |
| studio_launch_tickets | id; ticket_hash; user_id; app_session_id; workspace_id; challenge_id; acl_epoch; expires_at; consumed_at | Thirty-second atomic single-use exchange |
| studio_sessions | id; token_hash; user_id; app_session_id; workspace_id; lease_epoch; expires_at; revoked_at | Gateway-only workspace session |
| workers | id; capability_profile; runtime_digest; health; heartbeat_at; available_capacity | Registered execution capacity |
| build_jobs | id; project_id; version_id; snapshot_id; actor_id; target; state; lease/fence; toolchain_digest; attempts; timeout_at; error_code | Durable build from an immutable input |
| build_logs | (job_id,sequence) PK; at; bounded_text | Ordered log stream; no lost whole-array rewrites |
| build_artifacts | id; job_id; blob/storage_key; format; sha256; byte_length; verified_at | Authorized verified downloads |
| agent_conversations | id; project_id; version_id; owner_user_id; visibility `private/members`; revision | Permission-scoped conversation |
| agent_messages | id; conversation_id; role; content; replaces_message_id; created_at | Message history, explicit edit/regenerate lineage |
| agent_proposals | id; conversation_id; actor_id; workspace_id; type; base_snapshot/revision; payload_hash; state; expires_at; approved_by; operation_id | Approved action lifecycle; never an unrestricted host command |
| history_events | id; project_id; version_id; actor_id; kind; before_snapshot_id; after_snapshot_id; operation_id | History references complete snapshots, not UTF-8 file dictionaries |

Queue claims use a SQL transaction with `FOR UPDATE SKIP LOCKED`, a lease deadline and an incrementing fence.
An expired worker may finish bytes but cannot commit canonical pointers with an old fence.
Job completion updates the job row and outbox in one transaction. A crashed claimant is reclaimed after lease expiry.
Worker capabilities declare supported targets; Windows, Linux and Android support is not inferred from the API host OS.

## 4. Community, preferences and events

| Entity | Key fields / constraints | Responsibility |
| --- | --- | --- |
| guest_devices | id; token_hash; created_at; expires_at | Random browser identity; never a User-Agent hash |
| favorites | (user_id,project_id) PK; created_at | Account-scoped favorites |
| recent_items | (user_id,project_id) PK; last_opened_at | Cross-device recent list |
| preference_imports | (user_id,import_id) PK; payload_hash; mapping_version; result | Idempotent user-approved import of local favorites/recents |
| ratings | id; project_id; user_id nullable; guest_id nullable; value 1..5; CHECK exactly one actor; unique per actor/project | User's or guest device's rating |
| comments | id; project_id; parent_id nullable; user_id nullable; guest_id nullable; legacy_author; text; moderation_state; created_at | Comments/replies; no guessed reassignment of historical guests |
| activity_events | id; project_id; release_id; kind; actor nullable; at | Raw activity with explicit retention/aggregation policy |
| audit_events | id; actor_id; project_id nullable; action; resource_id; result; request_id; at; redacted_details | Administrative/domain security audit; append-only application role |
| outbox_events | id; type; project_id nullable; actor_recipient nullable; resource_ids; revision; payload; committed_at | Durable source of client notifications |
| migration_runs | id; inventory_hash; mapping_hash; backup_id; state; verification_result; started_at; completed_at | Import evidence and rollback mapping |

Legacy anonymous authors remain historical guest identities unless an authenticated claim protocol can prove ownership.
User-Agent values cannot establish that proof. Already overwritten historical votes/comments cannot be reconstructed from a current export alone.

## 5. Permission matrix

Project owner is a derived role. All checks also require active user/project, valid session and current ACL epoch.

| Action | Owner | Maintainer | Developer | Viewer | Public visitor |
| --- | --- | --- | --- | --- | --- |
| Read member project metadata/source/history | yes | yes | yes | yes | released public bytes only |
| Open executable Theia / terminal | yes | yes | yes | no | no |
| Save/checkpoint private draft | yes | yes | yes | no | no |
| Create draft/version | yes | yes | yes | no | no |
| Change project metadata / version label | yes | yes | no | no | no |
| Submit manifest proposal | yes | yes | yes | no | no |
| Apply manifest proposal | yes | yes | no | no | no |
| Publish/unpublish/change published access | yes | yes | no | no | no |
| Request supported build | yes | yes | yes | no | no |
| Restore canonical history | yes | yes | no | no | no |
| Invite/change developer or viewer | yes | yes | no | no | no |
| Grant/revoke maintainer | yes | no | no | no | no |
| Transfer owner/delete project | yes | no | no | no | no |

Maintainers cannot change the owner or another maintainer. No member can grant authority beyond their allowed role.
System admin can suspend users, cap resources, stop a dangerous workload and inspect redacted operations/audit.
Moderator can moderate published comments/catalog policy. Neither global role implicitly reads private files, terminal, history or agent conversations.
Temporary support access, if needed, requires an owner-granted explicit membership/access record with reason, scope, expiry and audit; it is not an undocumented admin bypass.

Authorization contract:

```ts
type ProjectAction = 'project.read' | 'source.read' | 'source.write'
  | 'studio.execute' | 'metadata.write' | 'version.create' | 'release.publish'
  | 'members.manage' | 'owner.transfer' | 'project.delete' | 'history.restore';
interface Actor { userId: string; sessionId: string; authEpoch: number }
interface ProjectGrant { projectId: string; aclEpoch: number; action: ProjectAction }
requireProjectAction(actor: Actor, projectId: string, action: ProjectAction): Promise<ProjectGrant>;
```

Public unauthenticated access is a separate publication policy, not a synthetic project-member grant.
Controllers do not accept `userId`, owner, roles or platform capability from request bodies as the actor.
Every private repository query requires an authorized project context. New private routes are deny-by-default.
Missing session returns 401. A known member denied an action returns 403. A nonmember asking for a private resource returns 404.

Private DB rows also use row-level policies with an application role that has no BYPASSRLS/table-owner privileges.
The service sets verified actor/project context with `SET LOCAL` inside a transaction; pool reuse must not leak that context.
Public reads use a published view and a restricted reader role. Migration and system-job roles are separate, never available in the sandbox.
Authorization remains in the service; RLS is a second boundary with connection-reuse tests.

## 6. Account flows and exact policy

| Flow | Contract / rule |
| --- | --- |
| Register | `POST /api/v1/auth/register`; display name, email, password; generic 202 response; pending user + verify mail action created atomically |
| Verify | Token in submitted POST body; 24-hour expiry; consume once; activate user; rotate session if present |
| Resend verification | Generic 202; max three per email/hour and twenty per IP/hour |
| Login | Email/password; generic 401 for invalid/suspended/nonexistent user; rotate session; pending account may only access verification/profile/logout |
| Password | 12..128 Unicode code points, max 512 UTF-8 bytes; do not trim/change digits; Argon2id m=19456 KiB, t=2, p=1 minimum, benchmark and record configuration |
| Reset request | Generic 202 for every email; max three per email/hour and twenty per IP/hour |
| Reset completion | 30-minute single-use token; update verifier, increment auth_epoch and revoke all app/studio sessions in one transaction; notify account; require login |
| App session | Random 256-bit secret; only hash in DB; 24-hour idle and 30-day absolute expiry; throttled last_seen write; persistent DB record survives API restart |
| Cookie | `__Host-gv_session`; Secure, HttpOnly, Path=/, SameSite=Lax; no Domain; remaining lifetime sets Max-Age; localhost-only development exception explicitly configured |
| Device list | `GET /api/v1/me/sessions`; current marker, created/last_seen, coarse device label; never full tokens |
| Logout | Revoke current app session and its studio sessions; expire cookie |
| Logout all | `POST /api/v1/me/sessions/revoke-all`; reauthentication required; increment auth_epoch; revoke app/studio sessions |
| Sensitive actions | Password/email change, OAuth link/unlink, ownership transfer require authentication within ten minutes |
| Login throttle | Five failures per normalized email/15 minutes + twenty attempts per IP/15 minutes; shared DB bucket; generic 429 and Retry-After; no indefinite lockout |
| Email change | Reauthenticate, verify new address, atomic uniqueness check, notify old address, revoke other sessions |

Password storage and cookie/session choices follow [OWASP password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
Token values, password bodies, OAuth codes and email links are excluded from request logs.
Mutating browser endpoints require a session-bound CSRF token and an allowlisted Origin; SameSite alone is not the only check.
Email delivery uses a narrow SMTP/provider adapter; development uses a local mail sink, never fake production verification.

## 7. Google login/linking, later isolated delivery

Use authorization-code OIDC with PKCE S256, state and nonce through a maintained protocol implementation, initially `oauth4webapi`.
Provider configuration, client secret and flow storage stay on the control plane.
Validate signature, issuer, audience/authorized party, nonce and expiry; identify the account by `(issuer, sub)`.
Google explicitly defines `sub` as the stable identifier rather than email: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect).

| Situation | Result |
| --- | --- |
| Known issuer/subject | Login to its already linked active user |
| Unknown issuer/subject, no email collision | Offer/create a new account only with verified provider email and accepted registration terms |
| Unknown issuer/subject, email matches an existing account | Do not login to or link the existing account; ask for its existing login/recovery, then explicit linking |
| User chooses connect Google in Security settings | Require recent local/session reauthentication; start `purpose=link` bound to current user/session; explicit confirmation; unique identity insert |
| Flow session/user changes before callback | Reject linking; preserve existing account; consumed/expired flow cannot be replayed |
| Identity already belongs to another user | 409 `EXTERNAL_IDENTITY_IN_USE`; never merge automatically |
| User unlinks last authentication method | Reject; first establish a verified alternative password/provider method |

Requested scopes are `openid email profile`; no Drive/Gmail access or refresh-token persistence is needed for sign-in.
Offline credentials are not requested unless a separately approved feature needs them.

## 8. Wire consistency

```ts
interface ApiError {
  error: { code: string; message: string; requestId: string; fieldErrors?: Record<string,string> };
}
interface VersionSummary { id: string; label: string; state: 'draft'|'published'|'archived'; revision: number }
interface OperationReceipt { operationId: string; state: 'planned'; statusUrl: string }
interface OperationStatus {
  operationId: string;
  state: 'planned'|'staging'|'bytes_ready'|'committed'|'conflict'|'aborted'|'failed';
  progress: { completedBytes: number; totalBytes: number|null };
  error?: { code:string; retryable:boolean };
}
interface DomainEvent {
  id: string; type: string; projectId?: string; versionId?: string;
  resourceId: string; revision: number; committedAt: string;
}
```

`GET /api/v1/projects/:id` returns project metadata revision, capabilities and a typed versions array.
`GET /api/v1/catalog` returns released metadata and immutable release/play/download IDs, never draft version lists.
`GET /api/v1/operations/:id` checks actor/project access and returns state, bounded progress and stable error code.
Revision-checked mutations require `If-Match`/expected revision; absent precondition returns 428, stale revision returns 409.
Cross-system mutation requests require Idempotency-Key; key reuse with a different request hash returns 409.
All private API and cookie/session responses use `Cache-Control: no-store`.

## 9. Behavioral evidence required before activation

Tests must use two owners, two projects, a maintainer, developer, viewer, public guest and system admin.
For every private route: authorized case, member-without-permission, nonmember, revoked/suspended actor and deleted resource.
Test forged body actor IDs, cross-project version/snapshot IDs, role escalation and ownership-transfer races.
Test pooled DB context reuse from owner A to B and public reads; A's rows must not become visible to B.
Test reset/link/verify token replay, login buckets across two API instances, absolute/idle expiry and restart persistence.
Test matching Google email with a different subject does not grant the existing user's account.
