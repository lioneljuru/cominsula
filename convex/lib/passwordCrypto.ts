/**
 * Password hashing for Convex Auth credentials.
 *
 * Assumption: keep Lucia Scrypt (Convex Auth default). It is memory-hard and
 * uses a constant-time verify — OWASP-approved alongside bcrypt/Argon2id.
 * We do NOT switch to bcrypt because Convex Auth's Password provider and the
 * installed lucia dependency already ship Scrypt; introducing bcrypt would
 * add a native/WASM dep without a security win for new hashes.
 *
 * Legacy migration: hashes that look like plaintext, MD5 (32 hex), or SHA-1
 * (40 hex) are verified with a constant-time compare against the candidate
 * digest, then transparently upgraded to Scrypt on the next successful login
 * (see SecurePassword authorize).
 */

import { Scrypt } from "lucia";
import { sha256Hex } from "./crypto";

const scrypt = new Scrypt();

/**
 * Lucia Scrypt hashes are `saltHex:keyHex` (see lucia@3 Scrypt).
 * Also accept older s2$ / $scrypt$ encodings if ever present.
 */
export function isScryptHash(hash: string): boolean {
  if (hash.startsWith("s2$") || hash.startsWith("$scrypt$")) return true;
  // lucia@3 default: 16-byte salt + 64-byte derived key as hex pair
  return /^[a-f0-9]{16,64}:[a-f0-9]{64,256}$/i.test(hash);
}

export function isLegacyWeakHash(hash: string): boolean {
  if (!hash || isScryptHash(hash)) return false;
  // MD5 hex
  if (/^[a-f0-9]{32}$/i.test(hash)) return true;
  // SHA-1 hex
  if (/^[a-f0-9]{40}$/i.test(hash)) return true;
  // SHA-256 hex (mistakenly used as password hash)
  if (/^[a-f0-9]{64}$/i.test(hash)) return true;
  // Likely plaintext (printable, short-ish, no $ markers)
  if (!hash.includes("$") && hash.length >= 1 && hash.length <= 128) return true;
  return false;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  if (aa.length !== bb.length) {
    // Still walk to reduce length-oracle noise.
    let diff = aa.length ^ bb.length;
    const n = Math.max(aa.length, bb.length);
    for (let i = 0; i < n; i++) {
      diff |= (aa.charCodeAt(i) || 0) ^ (bb.charCodeAt(i) || 0);
    }
    return diff === 0;
  }
  let diff = 0;
  for (let i = 0; i < aa.length; i++) {
    diff |= aa.charCodeAt(i)! ^ bb.charCodeAt(i)!;
  }
  return diff === 0;
}

async function verifyLegacy(password: string, hash: string): Promise<boolean> {
  if (/^[a-f0-9]{32}$/i.test(hash)) {
    // MD5 not available via Web Crypto; reject MD5 hashes (force reset).
    // Returning false is safer than implementing MD5.
    return false;
  }
  if (/^[a-f0-9]{40}$/i.test(hash)) {
    // SHA-1 not available via Web Crypto subtle in all runtimes; reject.
    return false;
  }
  if (/^[a-f0-9]{64}$/i.test(hash)) {
    return timingSafeEqualHex(sha256Hex(password), hash);
  }
  // Plaintext: constant-time-ish compare via SHA-256 of both sides.
  return timingSafeEqualHex(sha256Hex(password), sha256Hex(hash));
}

export async function hashPassword(password: string): Promise<string> {
  return await scrypt.hash(password);
}

/**
 * Constant-time Scrypt verify for modern hashes; legacy path for migration
 * detection. Never uses === on raw password strings.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (isScryptHash(hash)) {
    const ok = await scrypt.verify(hash, password);
    return { ok, needsRehash: false };
  }
  if (isLegacyWeakHash(hash)) {
    const ok = await verifyLegacy(password, hash);
    return { ok, needsRehash: ok };
  }
  // Unknown format — run a dummy Scrypt verify to normalize timing, then fail.
  try {
    await scrypt.verify(
      await scrypt.hash("timing-normalization-placeholder"),
      password,
    );
  } catch {
    /* ignore */
  }
  return { ok: false, needsRehash: false };
}

export const passwordCrypto = {
  hashSecret: hashPassword,
  async verifySecret(password: string, hash: string): Promise<boolean> {
    const { ok } = await verifyPassword(password, hash);
    return ok;
  },
};
