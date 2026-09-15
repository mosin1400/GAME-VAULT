const FALLBACK_RETURN_PATH = '/';
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

function decodedForSafetyCheck(value: string): string | null {
  let decoded = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return decoded;
      decoded = next;
    } catch {
      return null;
    }
  }
  return decoded;
}

/**
 * Return only an application-local, URL-safe path after authentication.
 * We decode repeatedly for validation because a single decode pass misses a
 * double-encoded scheme-relative redirect such as /%252f%252fevil.example.
 */
export function safeReturnPath(candidate: unknown, fallback = FALLBACK_RETURN_PATH): string {
  if (typeof candidate !== 'string' || !candidate.startsWith('/')) return fallback;

  const decoded = decodedForSafetyCheck(candidate);
  if (
    decoded === null
    || CONTROL_CHARACTER.test(candidate)
    || CONTROL_CHARACTER.test(decoded)
    || candidate.includes('\\')
    || decoded.includes('\\')
    || decoded.startsWith('//')
  ) {
    return fallback;
  }

  try {
    const localOrigin = 'https://game-vault.invalid';
    const url = new URL(candidate, localOrigin);
    return url.origin === localOrigin ? candidate : fallback;
  } catch {
    return fallback;
  }
}
