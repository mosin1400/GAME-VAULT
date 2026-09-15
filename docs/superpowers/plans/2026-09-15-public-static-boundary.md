# P01: public static boundary

Dependencies: P00 byte-preservation tooling; no application-data rewrite in this package. Production cutover remains blocked on frozen/runtime restore verification.

Goal: remove arbitrary root-file publication without replacing Theia or removing its existing tests.

Files: `backend/http/static-assets.js`, new `backend/http/static-response.js`, `server.js`, `tests/http/public-static.test.cjs`; legacy-only test cleanup in six root test files.

Input: root directory, HTTP method and URL pathname. Output: approved file bytes or a generic 404/405/500, never a host path or underlying exception.

1. Write failing fixture HTTP tests: current public pages/assets survive, source/account files stay private, protected environment names are rejected before filesystem access, traversal and physical links fail closed, missing assets return 404.
2. Replace arbitrary resolver fallback with explicit frontend maps and a temporary game-version web-asset boundary. Do not publish game metadata, dependency folders, configuration, source maps or arbitrary imported applications. Public game source remains inherently visible until immutable release publication replaces the compatibility boundary.
3. Validate decoded paths, separator containment, link ancestors and regular-file identity. Read from the validated handle, not a second unchecked pathname.
4. Integrate response handler; redact outer exception response. Validate via fixture HTTP server without loading product environment or starting Theia/commands.
5. Remove only deleted-editor assertions and the retired legacy-chat test. Preserve actual Theia tests. Replace nonexistent system-tools project with a disposable fixture. Imported applications without versions are classified separately, not fabricated into games.

Acceptance: behavioral tests and all surviving root contracts pass; real deployment probe remains separate until an owned process can safely be restarted without opening environment files.

Rollback: preserve explicit-source backup; revert only this package's source files, never restore over live data. Do not silently reopen arbitrary static root publication on a public server.
