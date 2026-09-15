BEGIN;

CREATE TYPE app.project_visibility AS ENUM ('private', 'members', 'unlisted', 'public');
CREATE TYPE app.project_member_role AS ENUM ('maintainer', 'developer', 'viewer');
CREATE TYPE app.version_state AS ENUM ('draft', 'published', 'archived');

CREATE TABLE app.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 120),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  visibility app.project_visibility NOT NULL DEFAULT 'private',
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  source_root_key uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT projects_owner_slug_unique UNIQUE (owner_user_id, slug)
);

CREATE TABLE app.project_members (
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  role app.project_member_role NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE app.project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  storage_key uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  display_label text NOT NULL CHECK (length(trim(display_label)) BETWEEN 1 AND 120),
  state app.version_state NOT NULL DEFAULT 'draft',
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (project_id, display_label)
);

CREATE INDEX projects_owner_active_idx ON app.projects(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX project_members_user_idx ON app.project_members(user_id, project_id);
CREATE INDEX project_versions_project_idx ON app.project_versions(project_id, created_at DESC);

CREATE FUNCTION app.is_project_member(target_project uuid, target_user uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM app.project_members WHERE project_id = target_project AND user_id = target_user)
$$;

CREATE FUNCTION app.can_manage_members(target_project uuid, target_user uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM app.projects WHERE id = target_project AND owner_user_id = target_user)
  OR EXISTS (SELECT 1 FROM app.project_members WHERE project_id = target_project AND user_id = target_user AND role = 'maintainer')
$$;

CREATE FUNCTION app.enforce_member_write() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE actor_role app.project_member_role;
DECLARE is_owner boolean;
DECLARE target_project uuid;
BEGIN
  target_project := CASE WHEN TG_OP = 'DELETE' THEN OLD.project_id ELSE NEW.project_id END;
  SELECT owner_user_id = app.actor_id() INTO is_owner FROM app.projects WHERE id = target_project;
  IF is_owner THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  SELECT role INTO actor_role FROM app.project_members WHERE project_id = target_project AND user_id = app.actor_id();
  IF actor_role IS DISTINCT FROM 'maintainer' THEN RAISE EXCEPTION 'project membership write denied' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'DELETE' AND OLD.role = 'maintainer' THEN RAISE EXCEPTION 'maintainer cannot remove maintainer' USING ERRCODE = '42501'; END IF;
  IF TG_OP <> 'DELETE' AND NEW.role = 'maintainer' THEN RAISE EXCEPTION 'maintainer cannot grant maintainer' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.role = 'maintainer' THEN RAISE EXCEPTION 'maintainer cannot change maintainer' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER project_members_role_guard
BEFORE INSERT OR UPDATE OR DELETE ON app.project_members
FOR EACH ROW EXECUTE FUNCTION app.enforce_member_write();

ALTER TABLE app.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE app.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.project_members FORCE ROW LEVEL SECURITY;
ALTER TABLE app.project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.project_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY projects_select ON app.projects FOR SELECT USING (
  owner_user_id = app.actor_id()
  OR app.is_project_member(id, app.actor_id())
  OR visibility IN ('public', 'unlisted')
);
CREATE POLICY projects_insert ON app.projects FOR INSERT WITH CHECK (owner_user_id = app.actor_id());
CREATE POLICY projects_update_owner ON app.projects FOR UPDATE USING (owner_user_id = app.actor_id()) WITH CHECK (true);

CREATE POLICY members_select ON app.project_members FOR SELECT USING (
  app.can_manage_members(project_id, app.actor_id()) OR user_id = app.actor_id()
);
CREATE POLICY members_write ON app.project_members FOR ALL USING (
  app.can_manage_members(project_id, app.actor_id())
) WITH CHECK (app.can_manage_members(project_id, app.actor_id()));

CREATE POLICY versions_select ON app.project_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM app.projects p WHERE p.id = project_id AND (
    p.owner_user_id = app.actor_id() OR app.is_project_member(p.id, app.actor_id()) OR p.visibility IN ('public', 'unlisted')
  ))
);
CREATE POLICY versions_insert ON app.project_versions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM app.projects p WHERE p.id = project_id AND (
    p.owner_user_id = app.actor_id() OR EXISTS (SELECT 1 FROM app.project_members m WHERE m.project_id = p.id AND m.user_id = app.actor_id() AND m.role IN ('maintainer', 'developer'))
  )) AND created_by_user_id = app.actor_id()
);
CREATE POLICY versions_update ON app.project_versions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM app.projects p WHERE p.id = project_id AND (
    p.owner_user_id = app.actor_id() OR EXISTS (SELECT 1 FROM app.project_members m WHERE m.project_id = p.id AND m.user_id = app.actor_id() AND m.role = 'maintainer')
  ))
) WITH CHECK (
  EXISTS (SELECT 1 FROM app.projects p WHERE p.id = project_id AND (
    p.owner_user_id = app.actor_id() OR EXISTS (SELECT 1 FROM app.project_members m WHERE m.project_id = p.id AND m.user_id = app.actor_id() AND m.role = 'maintainer')
  ))
);

INSERT INTO app.schema_migrations(version, checksum)
VALUES (2, 'projects-access-v1') ON CONFLICT (version) DO NOTHING;

COMMIT;
