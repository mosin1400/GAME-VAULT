BEGIN;

ALTER TABLE app.users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE TABLE app.password_credentials (
  user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
  argon2_hash text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  must_reset boolean NOT NULL DEFAULT false,
  CONSTRAINT password_credentials_argon2_format CHECK (argon2_hash LIKE '$argon2%')
);

CREATE TABLE app.external_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_-]{1,31}$'),
  issuer text NOT NULL,
  subject text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_authenticated_at timestamptz,
  UNIQUE (issuer, subject)
);
CREATE INDEX external_identities_user_idx ON app.external_identities(user_id);

CREATE TABLE app.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  auth_epoch integer NOT NULL CHECK (auth_epoch >= 0),
  csrf_secret_hash bytea NOT NULL CHECK (octet_length(csrf_secret_hash) = 32),
  device_label text NOT NULL DEFAULT '' CHECK (char_length(device_label) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT sessions_expiry_order CHECK (idle_expires_at <= absolute_expires_at)
);
CREATE INDEX sessions_user_active_idx ON app.sessions(user_id, last_seen_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX sessions_expiry_idx ON app.sessions(idle_expires_at) WHERE revoked_at IS NULL;

DO $$
BEGIN
  CREATE TYPE app.email_action_purpose AS ENUM ('verify_email', 'reset_password', 'change_email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE app.email_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  purpose app.email_action_purpose NOT NULL,
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  target_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT email_actions_expiry CHECK (expires_at > created_at),
  CONSTRAINT email_actions_target_normalized CHECK (target_email IS NULL OR target_email = lower(target_email))
);
CREATE INDEX email_actions_user_purpose_idx ON app.email_actions(user_id, purpose, created_at DESC);

CREATE TABLE app.oauth_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL CHECK (purpose IN ('login', 'link')),
  initiating_user_id uuid REFERENCES app.users(id) ON DELETE CASCADE,
  initiating_session_id uuid REFERENCES app.sessions(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_-]{1,31}$'),
  state_hash bytea NOT NULL UNIQUE CHECK (octet_length(state_hash) = 32),
  nonce_hash bytea NOT NULL CHECK (octet_length(nonce_hash) = 32),
  encrypted_pkce_verifier bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT oauth_flows_expiry CHECK (expires_at > created_at),
  CONSTRAINT oauth_link_requires_authenticated_context CHECK (
    purpose <> 'link' OR (initiating_user_id IS NOT NULL AND initiating_session_id IS NOT NULL)
  )
);
CREATE INDEX oauth_flows_expiry_idx ON app.oauth_flows(expires_at) WHERE consumed_at IS NULL;

CREATE TABLE app.auth_attempt_buckets (
  purpose text NOT NULL CHECK (purpose IN ('login_email', 'login_ip', 'register_email', 'reset_email')),
  subject_hash bytea NOT NULL CHECK (octet_length(subject_hash) = 32),
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (purpose, subject_hash, window_started_at),
  CONSTRAINT auth_attempt_bucket_expiry CHECK (expires_at > window_started_at)
);
CREATE INDEX auth_attempt_buckets_expiry_idx ON app.auth_attempt_buckets(expires_at);

DO $$
BEGIN
  CREATE TYPE app.mail_delivery_state AS ENUM ('pending', 'sending', 'sent', 'retryable_failure', 'permanent_failure');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE app.mail_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL UNIQUE REFERENCES app.email_actions(id) ON DELETE CASCADE,
  recipient_email text NOT NULL CHECK (recipient_email = lower(recipient_email)),
  state app.mail_delivery_state NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_message_id text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX mail_deliveries_pending_idx ON app.mail_deliveries(next_attempt_at, created_at)
  WHERE state IN ('pending', 'retryable_failure');

ALTER TABLE app.password_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.password_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE app.external_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.external_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE app.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.email_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.email_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.oauth_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.oauth_flows FORCE ROW LEVEL SECURITY;
ALTER TABLE app.auth_attempt_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.auth_attempt_buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE app.mail_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.mail_deliveries FORCE ROW LEVEL SECURITY;

CREATE POLICY external_identities_self_read ON app.external_identities
  FOR SELECT USING (user_id = app.actor_id());
CREATE POLICY sessions_self_read ON app.sessions
  FOR SELECT USING (user_id = app.actor_id());

INSERT INTO app.schema_migrations(version, checksum)
VALUES (4, 'identity-security-v1') ON CONFLICT (version) DO NOTHING;

COMMIT;
