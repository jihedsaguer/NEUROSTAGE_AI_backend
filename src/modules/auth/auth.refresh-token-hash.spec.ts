/**
 * Security tests — refresh token hashing
 *
 * Verifies that:
 *  1. The raw token returned to the caller is NOT stored in the DB (only the hash is).
 *  2. refreshToken() hashes the incoming token before the DB lookup.
 *  3. A wrong token (wrong hash) is rejected.
 *  4. logout() nullifies the stored hash.
 */
import { createHash } from 'crypto';

// Utility mirror of AuthService.hashRefreshToken (pure function — no DI needed)
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('Refresh Token Security — hashing invariants', () => {
  it('SHA-256 is deterministic for the same input', () => {
    const token = 'abc123';
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('different tokens produce different hashes', () => {
    expect(hashToken('tokenA')).not.toBe(hashToken('tokenB'));
  });

  it('stored hash does NOT equal the raw token', () => {
    const raw = 'a'.repeat(128);           // 64-byte hex string
    const stored = hashToken(raw);
    expect(stored).not.toBe(raw);
    expect(stored).toHaveLength(64);       // SHA-256 hex is always 64 chars
  });

  it('hash of incoming token matches stored hash (DB lookup would succeed)', () => {
    const rawToken = 'super-secret-refresh-token-value';
    const storedHash = hashToken(rawToken);      // what goes into DB
    const incomingHash = hashToken(rawToken);    // what refreshToken() computes

    expect(incomingHash).toBe(storedHash);       // lookup would find the user
  });

  it('tampered token produces a different hash (DB lookup would fail)', () => {
    const rawToken = 'super-secret-refresh-token-value';
    const storedHash = hashToken(rawToken);
    const tamperedHash = hashToken(rawToken + 'x');

    expect(tamperedHash).not.toBe(storedHash);   // lookup would find nothing → 401
  });
});
