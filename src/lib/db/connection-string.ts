const VERIFIED_TLS_COMPATIBILITY_MODES = /([?&]sslmode=)(prefer|require|verify-ca)(?=(&|#|$))/gi;

/**
 * Preserve the verified-TLS behavior used by pg 8.x while avoiding its
 * compatibility warning ahead of pg 9's libpq-compatible sslmode semantics.
 *
 * We only rewrite sslmode values that pg 8 currently treats as verify-full;
 * all other connection-string bytes are left untouched.
 */
export function normalizePgSslMode(connectionString: string | undefined): string | undefined {
  const trimmed = connectionString?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(VERIFIED_TLS_COMPATIBILITY_MODES, '$1verify-full');
}
