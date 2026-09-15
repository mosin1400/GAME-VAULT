# Game Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished Persian RTL game-management dashboard with image-based game cards, play/download actions, and a password-protected editor for adding, editing, and deleting games.

**Architecture:** A local Node.js server owns the `games/<slug>/versions/<version>/` project tree, validates `readme.json`, handles ZIP extraction, persists activity/history, and proxies OpenRouter. The browser frontend renders the dashboard and a VS Code-like editor with version selection, file tree, snapshots/diffs, skill selection, and agent chat.

**Tech Stack:** Node.js built-in HTTP/fs/path/crypto modules, HTML, CSS, vanilla JavaScript, Web Crypto SHA-256, local JSON metadata, optional PowerShell ZIP extraction on Windows.

## Global Constraints

- All project files live inside `Downloads/بازی منیجر`.
- The interface is Persian and RTL.
- Every game card includes an image, name, description, five-star rating, generating AI, play, and download controls.
- Editor mode requires password `192837465` and supports add, edit, delete, and local persistence.
- OpenRouter API keys must not be placed in browser JavaScript or committed files.
- Existing game files in `Downloads/t3475` remain untouched.
- Every version is a standalone project under `games/<slug>/versions/<version>/`.
- The editor never displays versions as folders in the project tree; users select a version before opening its tree.
- Agent changes require a diff preview and explicit confirmation for file mutations.

---

### Task 1: Static dashboard shell

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `data/games.json`

- [ ] Create semantic RTL page structure with navigation, stats, search, category filters, game grid, and editor entry point.
- [ ] Add realistic starter game records with image URLs and all requested metadata.
- [ ] Add responsive visual system: deep navy background, cyan/amber accents, glass cards, accessible focus states, and mobile layout.

### Task 2: Dashboard behavior and secure editor gate

**Files:**
- Create: `app.js`

- [ ] Load starter records, prefer localStorage overrides, render cards, search, filters, star labels, and stats.
- [ ] Add play/download click handling using each record's configured URLs.
- [ ] Compare the entered editor password using SHA-256 against the stored digest; never store the cleartext password in source.
- [ ] Add editor mode state, modal feedback, escape-key closing, and logout behavior.

### Task 3: Folder-style editor and local persistence

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

- [ ] Add editor drawer with a folder rail and form fields for image, name, slug, description, rating, AI, category, play URL, and download URL.
- [ ] Support creating, selecting, editing, saving, and deleting records with a confirmation step.
- [ ] Validate required fields and preserve data in localStorage so refreshes retain edits.
- [ ] Provide visible success/error toast messages and an empty-state card.

### Task 4: OpenRouter integration boundary and verification

**Files:**
- Create: `api/.env.example`
- Create: `api/README.md`
- Create: `README.md`
- Create: `.gitignore`

- [ ] Document that the API key belongs in an untracked server environment variable and provide a proxy contract without exposing a real secret.
- [ ] Document local serving and editor password setup.
- [ ] Verify JavaScript syntax, JSON parsing, required field presence, and local HTTP response.

### Task 5: Local project server and versioned storage

**Files:**
- Create: `server.js`
- Create: `package.json`
- Create: `.env.example`
- Create: `games/t34-steel-front/versions/v1.0.0/readme.json`
- Create: `games/t34-steel-front/versions/v1.0.0/README.md`
- Create: `games/t34-steel-front/versions/v1.0.0/game.html`

- [ ] Serve the frontend and expose JSON APIs for games, versions, trees, file reads/writes, version creation/rename/deletion, and backups.
- [ ] Validate path containment and reject traversal, unsupported extensions, and invalid metadata.
- [ ] Extract ZIP uploads into a selected version with a containment check and required-file validation.
- [ ] Store each version as an independent project and keep version names out of the file tree.

### Task 6: VS Code-like editor, history, skills, and agent chat

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`
- Create: `skills/code-review/skill.json`
- Create: `skills/code-review/instructions.md`
- Create: `skills/bug-fix/skill.json`
- Create: `skills/bug-fix/instructions.md`
- Create: `skills/metadata-auditor/skill.json`
- Create: `skills/metadata-auditor/instructions.md`

- [ ] Add a version picker before opening the editor, a project tree, file tabs, text editing, create/rename/delete controls, and upload controls.
- [ ] Add Git-like snapshots with author, message, changed-file list, diff, restore, and AI/manual attribution.
- [ ] Add skill selection and skill creation/editing in `skills/`.
- [ ] Add contextual OpenRouter chat inside the editor, with selected game/version/file context and approval-gated mutations.

### Task 7: Dashboard, details, PWA, and verification

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`
- Create: `manifest.webmanifest`
- Create: `sw.js`

- [ ] Add professional activity stats, favorite state, details view, play/download counters, advanced filters, light/dark mode, and published/in-progress status.
- [ ] Add export/import backup actions and link health checks.
- [ ] Add PWA install metadata and offline shell caching.
- [ ] Verify server APIs, metadata rejection, version isolation, history restore, ZIP extraction, and frontend syntax.
