BEGIN;

CREATE TYPE app.audit_subject_type AS ENUM ('project', 'version', 'membership', 'release');

CREATE TABLE app.project_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  operation_type text NOT NULL CHECK (operation_type ~ '^[a-z][a-z0-9_.-]{2,80}$'),
  fence bigint NOT NULL CHECK (fence > 0),
  state text NOT NULL CHECK (state IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, fence),
  UNIQUE (request_id)
);

CREATE TABLE app.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid REFERENCES app.projects(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  subject_type app.audit_subject_type NOT NULL,
  subject_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.-]{2,80}$'),
  revision bigint,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_events_project_idx ON app.audit_events(project_id, id DESC);

ALTER TABLE app.project_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.project_operations FORCE ROW LEVEL SECURITY;
ALTER TABLE app.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY operations_project_access ON app.project_operations FOR SELECT USING (
  EXISTS (SELECT 1 FROM app.projects p WHERE p.id = project_id AND (p.owner_user_id = app.actor_id() OR app.is_project_member(p.id, app.actor_id())))
);
CREATE POLICY audit_project_access ON app.audit_events FOR SELECT USING (
  project_id IS NOT NULL AND EXISTS (SELECT 1 FROM app.projects p WHERE p.id = project_id AND (p.owner_user_id = app.actor_id() OR app.is_project_member(p.id, app.actor_id())))
);

INSERT INTO app.schema_migrations(version, checksum)
VALUES (3, 'storage-events-v1') ON CONFLICT (version) DO NOTHING;

COMMIT;
