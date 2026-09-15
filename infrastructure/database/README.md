# PostgreSQL deployment contract

These migrations are designed for PostgreSQL 18 and must be applied in numeric order by a migration-owner role, never by the runtime application role.

## Roles

1. `game_vault_migrator` owns schema `app`, creates extensions/types/tables/policies and runs the files in `migrations/` once.
2. `game_vault_app` is the API login role. It receives only table/function privileges required by its repository methods. It must not own tables, be a superuser, have `BYPASSRLS`, or inherit from a role with either privilege.
3. A request transaction sets `SET LOCAL app.actor_id = '<validated UUID>'` only after session authentication. Pooled connections must use a transaction for every request so actor state cannot leak to the next request.

## Required verification before activation

- Run migrations against a disposable PostgreSQL instance and record each file checksum in `app.schema_migrations`.
- Connect as `game_vault_app`; prove `SELECT` on a private project by a different owner returns no row.
- In separate pooled transactions, prove a developer cannot publish or transfer ownership, a maintainer cannot grant maintainer, and a platform admin with no membership cannot read private source metadata.
- Exercise ownership transfer under concurrent requests and require one final owner, matching membership/audit rows and a monotonic revision.
- Apply migration 004 and prove the application role cannot directly read password, session-token, CSRF, email-action or OAuth-flow secret material. Authentication lookups must be limited to reviewed repository functions/queries, never broad table grants.
- Run registration, verification, login, reset, session rotation, device revocation and logout-all across two API instances against a development mail sink. Prove idle/absolute expiry and a changed `auth_epoch` reject an existing cookie.

Do not import existing JSON/game data or enable v1 project routes until these checks pass. The SQL migrations are additive; rollback disables new routes rather than dropping user data.
