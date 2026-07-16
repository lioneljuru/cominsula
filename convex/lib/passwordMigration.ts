/**
 * Transparent password re-hash migration (audit §3).
 *
 * Runtime path: `SecurePassword` authorize checks `isLegacyWeakHash(stored)`
 * after a successful sign-in and calls `modifyAccountCredentials` so the next
 * login uses Scrypt. No forced reset required.
 *
 * Offline scan helper (for ops / one-off scripts): iterate authAccounts and
 * count rows whose `secret` matches legacy patterns. This module is safe to
 * import from Node tests; it does not perform DB I/O itself.
 */

import { isLegacyWeakHash, isScryptHash } from "./passwordCrypto";

export type HashClass = "scrypt" | "legacy_weak" | "unknown";

export function classifyPasswordHash(secret: string | null | undefined): HashClass {
  if (!secret) return "unknown";
  if (isScryptHash(secret)) return "scrypt";
  if (isLegacyWeakHash(secret)) return "legacy_weak";
  return "unknown";
}

export function summarizeHashClasses(
  secrets: Array<string | null | undefined>,
): Record<HashClass, number> {
  const out: Record<HashClass, number> = {
    scrypt: 0,
    legacy_weak: 0,
    unknown: 0,
  };
  for (const secret of secrets) {
    out[classifyPasswordHash(secret)]++;
  }
  return out;
}
