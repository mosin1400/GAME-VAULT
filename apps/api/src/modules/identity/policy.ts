export type AccountState = 'pending_verification' | 'active' | 'suspended' | 'deleted';

export interface SessionRecord {
  authEpoch: number;
  revokedAt: Date | null;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export interface AccountAuthState {
  state: AccountState;
  authEpoch: number;
}

export interface SessionExpiry {
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export class IdentityPolicyError extends Error {
  constructor(readonly code: 'PASSWORD_TOO_SHORT' | 'PASSWORD_TOO_LONG' | 'SESSION_NOT_ACTIVE') {
    super(code);
  }
}

export const PASSWORD_MINIMUM_CODE_POINTS = 12;
export const PASSWORD_MAXIMUM_CODE_POINTS = 1024;
export const SESSION_IDLE_MILLISECONDS = 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

function codePointLength(value: string): number {
  return Array.from(value).length;
}

/**
 * Validates precisely the string supplied by the user. Deliberately never trim,
 * case-fold or normalize a password: the stored Argon2 verifier must represent
 * the exact input the account holder chose.
 */
export function assertNewPassword(password: string): string {
  const length = codePointLength(password);
  if (length < PASSWORD_MINIMUM_CODE_POINTS) throw new IdentityPolicyError('PASSWORD_TOO_SHORT');
  if (length > PASSWORD_MAXIMUM_CODE_POINTS) throw new IdentityPolicyError('PASSWORD_TOO_LONG');
  return password;
}

export function createSessionExpiry(now: Date): SessionExpiry {
  const nowMs = now.getTime();
  return {
    idleExpiresAt: new Date(nowMs + SESSION_IDLE_MILLISECONDS),
    absoluteExpiresAt: new Date(nowMs + SESSION_ABSOLUTE_MILLISECONDS),
  };
}

/** Throws unless both account lifecycle and every session revocation boundary hold. */
export function assertActiveSession(session: SessionRecord, account: AccountAuthState, now: Date): void {
  const nowMs = now.getTime();
  if (
    account.state !== 'active'
    || session.revokedAt !== null
    || session.authEpoch !== account.authEpoch
    || session.idleExpiresAt.getTime() <= nowMs
    || session.absoluteExpiresAt.getTime() <= nowMs
  ) {
    throw new IdentityPolicyError('SESSION_NOT_ACTIVE');
  }
}
