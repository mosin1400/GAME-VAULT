# Native Game Builds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and download Windows EXE/ZIP, Linux AppImage/tar.gz, and Android APK from a selected HTML game version, with consented dependency installation.

**Architecture:** The Node server owns a persistent build-job queue and only executes a fixed allow-list of platform tools. The management UI creates jobs, polls their state, displays logs, and exposes finished artifacts. Each job uses only `games/<slug>/versions/<version>` as input and writes only to `builds/<slug>/<version>/<job-id>`.

**Tech Stack:** Node.js built-ins, Electron/electron-builder, Capacitor Android, Android SDK, Java LTS, PowerShell on Windows, WSL or Docker for Linux builds.

## Global Constraints

- Never run a package-manager or installer command until the user confirms the named tool from the UI.
- Never form a shell command from game metadata, file names, or chat text.
- A build job may read one game version and write only below `builds/`.
- Keep the public routes `/`, `/manage.html`, `/profile.html`, and `/editor.html` working.
- Do not report a package as downloadable until its file exists and has nonzero size.

---

### Task 1: Add build-job contracts and persistent storage

**Files:**
- Create: `backend/builds/contracts.js`
- Create: `backend/builds/store.js`
- Create: `builds/.gitkeep`
- Modify: `server.js`
- Test: `tests/build-store.test.js`

**Interfaces:**
- Produces `createBuildJob(input)`, `getBuildJob(id)`, `listBuildJobs(game, version)`, `appendBuildLog(id, line)`, and `finishBuildJob(id, result)`.
- A `BuildJob` has `{id, game, version, targets, status, createdAt, startedAt, finishedAt, logs, artifacts, error}`.

- [ ] **Step 1: Write the failing storage test**

```js
const job = await createBuildJob({game:'xc', version:'v1.0.0', targets:['windows-zip']});
assert.equal(job.status, 'queued');
assert.equal((await getBuildJob(job.id)).game, 'xc');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/build-store.test.js`

Expected: failure because `backend/builds/store.js` does not exist.

- [ ] **Step 3: Implement JSON-backed job storage**

```js
const BUILDS_ROOT = path.join(ROOT, 'builds');
const JOBS_FILE = path.join(BUILDS_ROOT, 'jobs.json');
function validateBuildInput({game, version, targets}) {
  if (!safePart(game) || !safePart(version)) throw Error('بازی یا نسخه معتبر نیست');
  if (!Array.isArray(targets) || !targets.every(t => BUILD_TARGETS[t])) throw Error('هدف ساخت معتبر نیست');
}
```

Persist jobs to `builds/jobs.json`; create directories with `fsp.mkdir(..., {recursive:true})`.

- [ ] **Step 4: Run the storage test**

Run: `node tests/build-store.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/builds/contracts.js backend/builds/store.js builds/.gitkeep tests/build-store.test.js server.js
git commit -m "feat: add persistent build job storage"
```

### Task 2: Add safe dependency detection and consented installation

**Files:**
- Create: `backend/builds/tools.js`
- Modify: `server.js`
- Test: `tests/build-tools.test.js`

**Interfaces:**
- Produces `inspectRequiredTools(targets) -> ToolStatus[]` and `installTool(toolId) -> InstallResult`.
- `ToolStatus` is `{id, label, requiredFor, installed, version, sizeLabel, installCommandLabel}`.
- Valid tool IDs are `node`, `electron-builder`, `java`, `android-sdk`, `wsl`, and `docker`.

- [ ] **Step 1: Write failing allow-list tests**

```js
assert.throws(() => toolDefinition('rm-rf'), /ابزار معتبر نیست/);
assert.equal(toolDefinition('java').sizeLabel, 'حدود ۲۰۰ تا ۴۰۰ مگابایت');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/build-tools.test.js`

Expected: failure because `toolDefinition` does not exist.

- [ ] **Step 3: Implement fixed tool definitions and detection**

```js
const TOOL_DEFINITIONS = {
  'electron-builder': {label:'Electron Builder', sizeLabel:'حدود ۲۰۰ مگابایت', requiredFor:['windows-exe','windows-zip','linux-appimage','linux-targz'], command:['npm.cmd','install','--save-dev','electron','electron-builder']},
  java: {label:'Java LTS', sizeLabel:'حدود ۲۰۰ تا ۴۰۰ مگابایت', requiredFor:['android-apk'], command:['winget','install','EclipseAdoptium.Temurin.21.JDK']}
};
```

On Windows, use `where.exe` for executable checks. `installTool` accepts only a key in `TOOL_DEFINITIONS`, invokes its fixed command with `execFile`, and returns captured output. Expose `GET /api/build-tools?targets=...` and `POST /api/build-tools/install`.

- [ ] **Step 4: Run the tool test**

Run: `node tests/build-tools.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/builds/tools.js tests/build-tools.test.js server.js
git commit -m "feat: add consented build tool installation"
```

### Task 3: Implement Windows packaging pipeline

**Files:**
- Create: `backend/builds/windows.js`
- Create: `backend/builds/templates/electron-main.cjs`
- Modify: `backend/builds/store.js`
- Test: `tests/build-windows.test.js`

**Interfaces:**
- Produces `buildWindows(job, context) -> Artifact[]`.
- Each artifact is `{platform:'windows', format:'exe'|'zip', file, size, url}`.

- [ ] **Step 1: Write failing artifact-path test**

```js
const dir = buildOutputDir({game:'xc',version:'v1.0.0',id:'job-1'});
assert.match(dir, /builds[\\/]xc[\\/]v1\.0\.0[\\/]job-1$/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/build-windows.test.js`

Expected: failure because `buildOutputDir` does not exist.

- [ ] **Step 3: Implement Electron staging and builder invocation**

```js
await fsp.cp(projectRoot(job.game, job.version), stagingGameDir, {recursive:true});
await fsp.writeFile(path.join(stagingRoot, 'package.json'), JSON.stringify({
  name: safePackageName(job.game), main:'electron-main.cjs',
  build:{appId:`local.gamevault.${safePackageName(job.game)}`, files:['game/**','electron-main.cjs'], win:{target:['nsis','zip']}}
}, null, 2));
await execFileAsync(npxCommand, ['electron-builder','--win','nsis','zip'], {cwd:stagingRoot});
```

Use an Electron main process template that loads `game/game.html` from the packaged app. Copy only files from the selected version. Record only files successfully found under the job output directory.

- [ ] **Step 4: Run the pipeline tests**

Run: `node tests/build-windows.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/builds/windows.js backend/builds/templates/electron-main.cjs tests/build-windows.test.js
git commit -m "feat: package Windows game builds"
```

### Task 4: Implement Linux and Android pipelines with actionable prerequisites

**Files:**
- Create: `backend/builds/linux.js`
- Create: `backend/builds/android.js`
- Create: `backend/builds/templates/capacitor.config.json`
- Test: `tests/build-platform-prerequisites.test.js`

**Interfaces:**
- Produces `buildLinux(job, context)` and `buildAndroid(job, context)`.
- Both return artifacts or throw a localized error naming the missing prerequisite.

- [ ] **Step 1: Write failing prerequisite tests**

```js
assert.throws(() => requireLinuxHost({wsl:false,docker:false}), /WSL یا Docker/);
assert.throws(() => requireAndroidToolchain({java:false, androidSdk:false}), /Java LTS و Android SDK/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/build-platform-prerequisites.test.js`

Expected: failure because prerequisite guards do not exist.

- [ ] **Step 3: Implement Linux output creation**

Invoke electron-builder only through the fixed Linux adapter. On Windows, choose WSL first when available; otherwise Docker. Request `AppImage` and `tar.gz`; write artifacts to the isolated job directory.

- [ ] **Step 4: Implement Android output creation**

Copy the selected game version into Capacitor `webDir`, generate a fixed `capacitor.config.json`, run only the fixed Capacitor commands, then Gradle assembleDebug. Locate `app-debug.apk`, copy it to the job output directory, and record it as `{platform:'android',format:'apk'}`.

- [ ] **Step 5: Run prerequisite tests**

Run: `node tests/build-platform-prerequisites.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/builds/linux.js backend/builds/android.js backend/builds/templates/capacitor.config.json tests/build-platform-prerequisites.test.js
git commit -m "feat: add Linux and Android build pipelines"
```

### Task 5: Add build queue APIs and protected artifact downloads

**Files:**
- Create: `backend/builds/queue.js`
- Modify: `server.js`
- Test: `tests/build-api.test.js`

**Interfaces:**
- Produces `enqueueBuild(input) -> BuildJob` and `runNextBuild() -> Promise<void>`.
- Endpoints: `POST /api/builds`, `GET /api/builds`, `GET /api/builds/:id`, `GET /api/builds/:id/download/:artifact`.

- [ ] **Step 1: Write failing API contract test**

```js
assert.equal((await request('POST','/api/builds',{game:'xc',version:'v1.0.0',targets:['windows-zip']})).status, 201);
assert.equal((await request('GET','/api/builds?game=xc&version=v1.0.0')).body.jobs[0].status, 'queued');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/build-api.test.js`

Expected: failure because `/api/builds` is not registered.

- [ ] **Step 3: Implement single-concurrency queue and download validation**

```js
let activeBuild = false;
async function runNextBuild() {
  if (activeBuild) return;
  const job = await nextQueuedJob();
  if (!job) return;
  activeBuild = true;
  try { await runBuildJob(job); } finally { activeBuild = false; queueMicrotask(runNextBuild); }
}
```

Reject invalid job IDs and artifact filenames. Resolve downloads from the artifact path stored in the job record, not a client-provided path.

- [ ] **Step 4: Run API test**

Run: `node tests/build-api.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/builds/queue.js server.js tests/build-api.test.js
git commit -m "feat: add queued native build API"
```

### Task 6: Build management UI and game-card download menu

**Files:**
- Create: `frontend/scripts/build-manager.js`
- Create: `frontend/styles/build-manager.css`
- Modify: `frontend/pages/manage.html`
- Modify: `frontend/scripts/manage.js`
- Modify: `frontend/styles/manage.css`
- Test: `tests/build-ui-contract.test.js`

**Interfaces:**
- Consumes `/api/build-tools`, `/api/build-tools/install`, `/api/builds`, and artifact download URLs.
- Produces `openBuildSheet(gameId)`, `refreshBuildJob(jobId)`, and `renderBuildDownloads(gameId, version)`.

- [ ] **Step 1: Write failing UI contract test**

```js
assert.match(html, /id="buildSheet"/);
assert.match(js, /openBuildSheet/);
assert.match(css, /\.build-sheet/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/build-ui-contract.test.js`

Expected: failure because the build UI does not exist.

- [ ] **Step 3: Implement the build sheet**

Render platform checkboxes, dependency cards with approximate sizes, a confirmation dialog per install action, a build button, progress/log panel, and artifact download buttons. `Build` remains disabled while any selected dependency is missing. Poll `GET /api/builds/:id` every 1.5 seconds while status is `queued` or `running`.

- [ ] **Step 4: Implement card download menu**

Each game card gets a `دانلود خروجی نصب` button. It shows only completed artifacts belonging to that game’s active version and labels each with platform and format, such as `Windows · EXE` or `Android · APK`.

- [ ] **Step 5: Run UI contract test and existing management tests**

Run: `node tests/build-ui-contract.test.js; node tests/management-terminal.test.js; node tests/navigation-views.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/manage.html frontend/scripts/manage.js frontend/scripts/build-manager.js frontend/styles/manage.css frontend/styles/build-manager.css tests/build-ui-contract.test.js
git commit -m "feat: add native build management UI"
```

### Task 7: Full integration verification and operator documentation

**Files:**
- Modify: `README.md`
- Create: `docs/native-builds.md`
- Test: `tests/build-integration.test.js`

**Interfaces:**
- Verifies the public management flow against a temporary game fixture and mock tool adapters.

- [ ] **Step 1: Write failing integration test**

```js
const job = await enqueueBuild({game:'fixture',version:'v1.0.0',targets:['windows-zip']});
await waitFor(() => getBuildJob(job.id).status === 'completed');
assert.equal(getBuildJob(job.id).artifacts[0].format, 'zip');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/build-integration.test.js`

Expected: failure until the queue uses injected mock adapters.

- [ ] **Step 3: Add adapter injection and documentation**

Keep production adapters as defaults; tests pass mock adapters to avoid downloading Electron, Android SDK, WSL, Docker, or Java. Document the output layout, supported formats, required approval, and exact command for starting the local server.

- [ ] **Step 4: Run the full verification suite**

Run: `node --check server.js; node --check frontend/scripts/build-manager.js; node tests/build-store.test.js; node tests/build-tools.test.js; node tests/build-windows.test.js; node tests/build-platform-prerequisites.test.js; node tests/build-api.test.js; node tests/build-ui-contract.test.js; node tests/build-integration.test.js; node tests/editor-workspace.test.js; node tests/management-terminal.test.js; node tests/navigation-views.test.js; node tests/auth-metadata-contract.test.js; node tests/guest-profile-contract.test.js`

Expected: every command exits with code 0.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/native-builds.md tests/build-integration.test.js
git commit -m "docs: document native game builds"
```
