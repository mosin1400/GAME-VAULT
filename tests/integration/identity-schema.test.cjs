"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.resolve(
  __dirname,
  "../../infrastructure/database/migrations/004-identity-security.sql",
);

function readMigration() {
  return fs.readFileSync(migrationPath, "utf8");
}

test("identity security migration keeps password, session and recovery secrets out of users", () => {
  const sql = readMigration();

  assert.match(sql, /CREATE TABLE app\.password_credentials/i);
  assert.match(sql, /CREATE TABLE app\.sessions/i);
  assert.match(sql, /CREATE TABLE app\.email_actions/i);
  assert.match(sql, /token_hash bytea NOT NULL/i);
  assert.match(sql, /auth_epoch integer NOT NULL/i);
  assert.doesNotMatch(sql, /ALTER TABLE app\.users[\s\S]*ADD COLUMN[^;]*(password|token|session)/i);
});

test("identity security migration models explicit external linking and bounded authentication state", () => {
  const sql = readMigration();

  assert.match(sql, /CREATE TABLE app\.external_identities/i);
  assert.match(sql, /UNIQUE \(issuer, subject\)/i);
  assert.match(sql, /CREATE TABLE app\.oauth_flows/i);
  assert.match(sql, /CREATE TABLE app\.auth_attempt_buckets/i);
  assert.match(sql, /CREATE TABLE app\.mail_deliveries/i);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/i);
  assert.match(sql, /VALUES \(4, 'identity-security-v1'\)/i);
});
