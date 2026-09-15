# Game Vault: audit بازاعتبارسنجی‌شده

Date: 2026-09-15. Current code and live loopback API were inspected.
Evidence: [redacted baseline](../evidence/2026-09-15-baseline.json).
Reproduce: `node scripts/audit-production-baseline.cjs`.
Tests: `node scripts/run-contracts.js` -> exit 1; 46 files, 40 passed, six failed.
No authenticated launch/terminal/build mutation or live history restore was executed in this audit.
No browser/mobile/visual acceptance or running Theia sandbox acceptance is claimed.
Component probes create disposable files in a verified OS-temp directory, never modify `games`, `.vault`, uploads or builds.

## Classification and severity

- B = behavior reproduced now through HTTP or a disposable component fixture.
- S = source-confirmed control-flow/contract defect; complete browser/user journey has not been executed.
- R = risk/hypothesis that needs a targeted experiment; not counted as a confirmed runtime defect.
- L = intentionally limited local capability/product scope; production redesign requirement, not necessarily a local bug.
- D = regression/stale reference following the authorized legacy-editor deletion.

P0: must be closed before exposure to an untrusted network.
P1: incorrect data/security boundary or core journey failure.
P2: UI/reliability/maintainability issue.
The number of entries is not an assurance of completeness. Each entry states its actual evidence level.

## Confirmed behavior

| ID | Class / priority | Evidence and reproduction | Impact / delivery |
| --- | --- | --- | --- |
| A01 | B / P0 | Anonymous GET `/server.js`, `/backend/auth/admin-account.js`, `/.vault/users.json` all returned 200; server.js bytes match the local source hash | Static resolver exposes backend and operational account data; explicit public asset serving required. P01 |
| A02 | B / P1 | Anonymous GET `/audit-missing-asset.css` -> 500 and JSON error contains absolute host path | Missing static files should be controlled 404; host paths must not leave server. P01 |
| A03 | B / P1 | Both existing t34 manifests reference `/versions/v1.0.0/game.html`; target absent; valid folders are `2` and `v1.1.0` | Current playable/download metadata targets a missing version. P06, P07 |
| A04 | B / P1 | `createGameCatalog.listGames()` / live `/api/games` yield versionCount=2 but no versions array | Theia toolbar reads `g?.versions`; cross-component contract cannot populate its version list. P03, P09 |
| A05 | B / P1 | Fixture `binary.png` with non-UTF-8 bytes -> snapshot string -> Buffer differs from original hash | A complete restore based on these strings corrupts binary media. P05, P10 |
| A06 | B / P1 | Fixture file exactly 1,000,000 bytes absent from snapshot | Restore deletes active root and restores only captured entries; omitted files can disappear. P05, P10 |
| A07 | B / P1 | Three fixture trials submit 20 concurrent comments; each persisted only one | Read-modify-write JSON loses acknowledged data; transactional community persistence required. P06C |
| A08 | B / P1 | `safeFile(project,'linked/sentinel.txt')` followed a fixture junction to a directory outside that project | Lexical containment does not enforce physical containment. Full filesystem/sandbox boundary required. P01/P05/P09 |
| A09 | B / P1 | `history.fileFor('..','outside')` resolves outside the configured vault | History service independently trusts path keys; authenticated history route also lacks initial projectRoot validation. Reachable file disclosure was not attempted. P05/P10 |
| A10 | B / P1 for production | Create session in service A; instantiate service B; same cookie is unknown | Process-local sessions are lost on API restart or split across instances. P04 |

Sensitive HTTP response bodies were not saved or printed. A01 proves unauthenticated file availability; it does not claim every secret file exists or that every stored record contains a plaintext password.
A08 used only a sentinel in the disposable fixture; no host-secret or cross-project file was read.

## Source-confirmed defects and contracts

### A11 — Shared host execution (S/P0 for production; P09/P10/P11)

`server.js` has `/api/terminal` using caller cwd/path and a real host PowerShell/sh process.
Agent action apply uses the host shell with only `cwd=root` as its workspace context.
Theia starts as a shared host process. API path validation cannot constrain shell filesystem/network access.
Reproduction for an authorized test environment: use two disposable workspace roots, execute a command reading the other root's sentinel, and inspect result. This live-host execution was deliberately not performed here.
The current private API admin guard exists. This finding does not assert that an anonymous user can call terminal.
Required acceptance: shell runs only within a per-user workspace sandbox and cannot read another workspace, host home, runtime socket or provider keys.

### A12 — Duplicate Agent POST handler (S/P1; P10)

`server.js:1265` handles POST `/api/agent/message` and returns on success/error.
The second same-method/same-path branch at `server.js:1272` is unreachable.
Theia sends `regenerateOf` and `replaceMessageId`; the active `backend/ai/agent-handler.js` does not consume them.
Behavioral test needed: send a user/assistant pair, regenerate the assistant and edit the user message with a stub AI transport; assert lineage and conversation count, not source strings.

### A13 — Workspace existence not checked (S/P1; P09)

`projectRoot()` validates identifier strings but does not stat the version directory.
`/api/theia/open` issues a token and starts Theia without validating existence.
Now, anonymous missing-version `/api/tree` returns 401 as expected; authenticated 500/launch behavior from the earlier review was not rerun.
Future fixture test: owner requests a nonexistent version UUID; 404, no provision call and no ticket issued.

### A14 — Navigation hides favorites/recent (S/P1; P07)

`frontend/scripts/app.js:navigateTo` toggles only dashboard/games/detail with equality to requested view.
Sidebar requests recent/favorites, so all those views are hidden; rendering only runs when view==='games'.
Test in a real DOM/browser: click each item and assert visible list, title, hash/back-navigation and empty state.
The current `navigation-views.test.js` passes despite this control-flow defect; its source assertions do not prove the interaction.

### A15 — Local preferences have no account scope and unguarded JSON (S/P1; P04/P07)

Favorites/recents use shared browser keys; switching users does not separate them.
`JSON.parse` is unguarded; a malformed storage value throws during rendering.
Test two logged-in users on one browser plus corrupt/missing/legacy local data; assert account-specific server results and a recoverable import prompt.

### A16 — Stale fallback and request-order race (S/P1; P07)

API failure substitutes `data/games.json`, which can disagree with actual source.
`loadGames()` assigns global `games` before checking `gamesRequestId`; a late old response can overwrite state even when rendering is skipped.
Test delayed response A, fresh B, then A resolution and subsequent interaction; UI must continue using B. Simulate 500 and show a retry state, not an unrelated fallback catalog.

### A17 — Partial new-game upload (S/P1; P05/P08)

`manage.js:addGame` creates game first, then posts image/package uploads separately.
Any later failure leaves a created partial project; there is no staged import commit or resume/cleanup protocol.
Test second upload failure with a disposable dataset; public project must remain unavailable, wizard must retain progress and expose resume/cancel.

### A18 — Version paths and links tied to labels (S/P1; P03/P05/P06)

`PATCH /api/version` physically renames a directory and changes only game.json.version.
Create/copy can retain the source play/download links. Catalog/readme/URLs can diverge.
Test rename after publication: version ID/storage key/release URL must remain unchanged; current display label advances by revision.

### A19 — Invalid metadata considered a valid version (S/P1; P03/P06)

`game-catalog.js:versions` sets `valid:!!meta`; `validateMeta(meta)` separately returns an error.
`listGames()` selects the first `valid` item without checking error.
Test a parseable JSON file with missing required keys; import/catalog must report a validation error instead of publishing it.

### A20 — Protected/generated metadata can overwrite authored README (S/P1; P05/P06)

`metadata-service.repair` writes a generated README; startup calls `synchronizeMetadataReadmes()`.
Current code can replace authored content as part of a metadata repair/startup.
Before a new migration starts, inventory and backup authored README bytes. Future behavior: README remains user source; managed export has a separate identity.
Test custom README, metadata change and restart; its hash must remain intact.

### A21 — Profile registration mismatch and return-path handling (S/P2; P01/P04)

Registration API deliberately returns 403. UI still shows registration tab/copy; script removes the form but not the tab.
Clicking the tab can hide the login form without a replacement.
Login return accepts `next.startsWith('/')`, including `//external-host`; this can navigate away after login.
Tests: existing local mode honestly displays its capability; production registration flow works; return paths reject scheme-relative URLs, backslashes, control characters and encoded equivalents.

### A22 — Repeated rerender and swallowed UI failures (S/P2; P07/P08)

`app.js` and `manage.js` refetch every five seconds; management init rerenders its cards and dashboard.
Several `.catch` branches suppress error feedback; management init/delete lacks a displayed rejection path.
Potential lost focus/card interaction needs browser reproduction. Existing wizard form reset occurs on open, not every interval; the earlier broad claim that every polling tick erases wizard input is withdrawn.
Test dirty forms, active dialog, slow network and failed delete; preserve input/focus and show bounded scoped retry.

### A23 — JSON stores beyond community (S/P1; P05/P10/P11)

History add and build store update/log operations also use whole-file read-modify-write without locking.
The community data-loss race was reproduced; build/history loss was not separately reproduced this turn.
Test concurrent log append/history entries and claimant restart against a disposable store before migration; new database paths must preserve acknowledged writes.

### A24 — Static containment prefix (S/P1; P01)

`safeStaticPath` checks `filePath.startsWith(root)` without a separator or realpath check.
A sibling whose name begins with root can pass that predicate in a direct function call.
Actual HTTP traversal/URL-decoding exploit was not tested; root-file disclosure A01 already occurs without traversal.
Test sibling-prefix, percent/double-encoded traversal, windows paths and links against the actual HTTP handler.

## Deliberate local limitations / future requirements

| ID | Classification | Current evidence | Production treatment |
| --- | --- | --- | --- |
| L01 | L | Only local @admin login; `/api/auth/register` explicitly disabled | Multiuser identity delivery, not proof that an intentionally local registration endpoint is defective |
| L02 | L | Studio CORS permits only http localhost/127.0.0.1:3010 | Explicit deployed origins/gateway; current local scope alone is not an exploit |
| L03 | L | Linux build on Windows explicitly reports missing execution adapter even if WSL/Docker is installed | Capability-based workers; UI must show unavailable target and supported adapters |
| L04 | L / product gap | Ten input directories use unrecognized formats; catalog only understands versions/game.json | Inventory/import states; do not label all ten as broken executable games |
| L05 | L / production blocker | Studio free mode opens host-oriented context; toolbar version query requires p.game | Keep free studio as user-owned isolated scratch workspace; explicit project selector replaces host browsing |
| L06 | L / production blocker | Studio token is an eight-hour process-local bearer in URL query | One-use POST launch and gateway sessions; no persistent token in URL |
| L07 | L / unreliable guest design | Guest identity is a User-Agent hash | Random guest device identity and explicit historical limitations; no automatic account claims |

## Hypotheses / measurements not yet completed

| ID | Risk | Required experiment | Delivery |
| --- | --- | --- | --- |
| R01 | Simplistic custom JS/CSS/HTML validators may report false positives | Fixture corpus of valid templates/strings/HTML, compare with language services | P09 |
| R02 | Theia PTY/watcher/language-server compatibility under runsc | Launch real IDE image under sandbox; edit/save, terminal, language service, checkpoint/revoke | P09; deployment gate |
| R03 | Large uploads/build logs/resources can exhaust host/workers | Bounded-size/decompression-bomb/rate/quota/fork tests on worker fixtures | P05/P09/P11 |
| R04 | Current profile HTML has link/script outside head; responsive/a11y quality unknown | HTML validation + keyboard/360px/browser acceptance | P07/P08 |
| R05 | Operations/history filesystem reliability under crashes | Fault injection after staging/byte promotion/final commit; restore receipt checks | P05/P06/P12 |

Large `server.js` (~56KB) and compressed extension code are confirmed maintainability concerns, not independently reproduced functional bugs.
Their split is required as features move into bounded modules; it is not counted as dozens of fabricated bugs.

## Deletion cleanup and test results

| ID | Class | Failing test / witness | Required action |
| --- | --- | --- | --- |
| D01 | D | asset-catalog-contract still expects editor-page.css | Remove only that legacy expectation; retain active assets checks |
| D02 | D | static-assets.test still expects editor-page.css mapping | Remove obsolete mapping assertion; add meaningful static behavior/security coverage |
| D03 | D | chat-submit-contract reads deleted editor-chat.js | Retire this legacy-only contract; preserve existing Theia chat/agent tests |
| D04 | D | theia-workspace-theme.test loops over deleted editor.html | Remove deleted page from its existing list; preserve Theia theme checks |
| D05 | D symptom of A02 | Removed editor URLs now return 500 instead of controlled missing-route status | Fix missing static handling; do not resurrect the editor |
| T01 | baseline fixture/layout | project-layout-contract assumes every input is a versioned game | Separate import-candidate fixtures from canonical layout validation |
| T02 | baseline fixture | system-tools.test uses nonexistent games/xc/versions/v1.0.0 | Create a disposable self-contained stats fixture; do not add fake product data |

Existing Theia agent/admin/CORS/problems/native/frontend/project-tools/theme-modes/toolbar contracts passed.
The four deletion-related failures and two dataset-fixture failures are the complete failure set observed in this run.
Passing source-contract tests do not validate actual multiuser execution isolation or UI behavior.

## Prioritized closure

P00 first preserves/inventories the current state and proves restore.
P01 closes A01/A02/A24 and D01..D05 with the current local app.
P03..P06 establish ownership, auth, immutable IDs and transactional data/storage migration.
P07..P11 repair actual frontend/Theia/agent/build journeys through those contracts.
P12 only activates server deployment after security, user-journey, migration and rollback acceptance.
No issue in this report is marked fixed merely because its solution is described.
