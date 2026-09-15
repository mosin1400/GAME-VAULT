"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  IdentityPolicyError,
  assertNewPassword,
  createSessionExpiry,
  assertActiveSession,
} = require("../../apps/api/dist/modules/identity/policy");

test("new passwords are never normalized and have clear bounded validation", () => {
  const exactPassword = "  رمز عبور طولانی و یکتا  ";
  assert.equal(assertNewPassword(exactPassword), exactPassword);

  assert.throws(
    () => assertNewPassword("short"),
    (error) => error instanceof IdentityPolicyError && error.code === "PASSWORD_TOO_SHORT",
  );
  assert.throws(
    () => assertNewPassword("x".repeat(1025)),
    (error) => error instanceof IdentityPolicyError && error.code === "PASSWORD_TOO_LONG",
  );
});

test("session expiry is bounded by both idle and absolute deadlines", () => {
  const now = new Date("2026-09-15T00:00:00.000Z");
  const expiry = createSessionExpiry(now);

  assert.equal(expiry.idleExpiresAt.toISOString(), "2026-09-16T00:00:00.000Z");
  assert.equal(expiry.absoluteExpiresAt.toISOString(), "2026-10-15T00:00:00.000Z");
});

test("suspended, revoked, stale-epoch and expired sessions are not authenticated", () => {
  const now = new Date("2026-09-15T12:00:00.000Z");
  const valid = {
    authEpoch: 3,
    revokedAt: null,
    idleExpiresAt: new Date("2026-09-15T13:00:00.000Z"),
    absoluteExpiresAt: new Date("2026-09-16T12:00:00.000Z"),
  };
  assert.doesNotThrow(() => assertActiveSession(valid, { state: "active", authEpoch: 3 }, now));

  for (const [session, account] of [
    [{ ...valid, revokedAt: now }, { state: "active", authEpoch: 3 }],
    [{ ...valid, authEpoch: 2 }, { state: "active", authEpoch: 3 }],
    [{ ...valid, idleExpiresAt: now }, { state: "active", authEpoch: 3 }],
    [valid, { state: "suspended", authEpoch: 3 }],
  ]) {
    assert.throws(
      () => assertActiveSession(session, account, now),
      (error) => error instanceof IdentityPolicyError && error.code === "SESSION_NOT_ACTIVE",
    );
  }
});
