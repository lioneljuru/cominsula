import { describe, expect, it } from "vitest";
import {
  sanitizeText,
  validateAndNormalizeEmail,
  validatePassword,
  validateDisplayName,
  AUTH_MESSAGES,
} from "./authValidation";
import { progressiveDelayMs } from "./authLockout";
import {
  hashPassword,
  verifyPassword,
  isLegacyWeakHash,
  isScryptHash,
} from "./passwordCrypto";
import { sha256Hex } from "./crypto";

describe("authValidation", () => {
  it("sanitizes HTML and control characters", () => {
    expect(sanitizeText("  <b>Ada</b>  ")).toBe("Ada");
    expect(sanitizeText("foo<script>alert(1)</script>")).toBe("fooalert(1)");
  });

  it("normalizes valid emails", () => {
    expect(validateAndNormalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("rejects invalid emails with a generic error", () => {
    try {
      validateAndNormalizeEmail("not-an-email");
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ data: { message: AUTH_MESSAGES.validationFailed } });
    }
  });

  it("rejects short passwords generically", () => {
    try {
      validatePassword("short");
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ data: { message: AUTH_MESSAGES.validationFailed } });
    }
  });

  it("sanitizes display names", () => {
    expect(validateDisplayName("<em>Pat</em>")).toBe("Pat");
  });
});

describe("authLockout progressive delay", () => {
  it("increases then caps", () => {
    expect(progressiveDelayMs(0)).toBe(0);
    expect(progressiveDelayMs(1)).toBe(250);
    expect(progressiveDelayMs(2)).toBe(500);
    expect(progressiveDelayMs(3)).toBe(1000);
    expect(progressiveDelayMs(10)).toBeLessThanOrEqual(8000);
  });
});

describe("passwordCrypto", () => {
  it("hashes with Scrypt and verifies constant-time path", async () => {
    const hash = await hashPassword("CorrectHorseBattery1");
    expect(isScryptHash(hash)).toBe(true);
    const ok = await verifyPassword("CorrectHorseBattery1", hash);
    expect(ok).toEqual({ ok: true, needsRehash: false });
    const bad = await verifyPassword("wrong-password-xx", hash);
    expect(bad.ok).toBe(false);
  });

  it("detects legacy SHA-256 hex and flags rehash", async () => {
    const legacy = sha256Hex("legacy-secret");
    expect(isLegacyWeakHash(legacy)).toBe(true);
    const result = await verifyPassword("legacy-secret", legacy);
    expect(result).toEqual({ ok: true, needsRehash: true });
  });

  it("detects plaintext legacy storage", async () => {
    expect(isLegacyWeakHash("plaintext-password")).toBe(true);
    const result = await verifyPassword("plaintext-password", "plaintext-password");
    expect(result.ok).toBe(true);
    expect(result.needsRehash).toBe(true);
  });
});
