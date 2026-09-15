BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum text NOT NULL
);

CREATE TYPE app.account_state AS ENUM ('pending_verification', 'active', 'suspended', 'deleted');
CREATE TYPE app.platform_role AS ENUM ('user', 'moderator', 'system_admin');

CREATE TABLE app.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  handle text NOT NULL,
  display_name text NOT NULL,
  state app.account_state NOT NULL DEFAULT 'pending_verification',
  platform_role app.platform_role NOT NULL DEFAULT 'user',
  auth_epoch integer NOT NULL DEFAULT 0 CHECK (auth_epoch >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT users_email_normalized CHECK (email = lower(email) AND position('@' IN email) > 1),
  CONSTRAINT users_handle_format CHECK (handle ~ '^[a-z0-9][a-z0-9_.-]{2,31}$')
);

CREATE UNIQUE INDEX users_email_active_unique ON app.users (email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_handle_active_unique ON app.users (handle) WHERE deleted_at IS NULL;

CREATE FUNCTION app.actor_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE raw_actor text := current_setting('app.actor_id', true);
BEGIN
  IF raw_actor IS NULL OR raw_actor = '' THEN RETURN NULL; END IF;
  RETURN raw_actor::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

INSERT INTO app.schema_migrations(version, checksum)
VALUES (1, 'identity-v1') ON CONFLICT (version) DO NOTHING;

COMMIT;
