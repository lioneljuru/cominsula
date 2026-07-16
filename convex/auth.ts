import { convexAuth } from "@convex-dev/auth/server";
import { SecurePassword } from "./lib/SecurePassword";

/**
 * Convex Auth (PRD §10: Supabase Auth is replaced by Convex Auth email/password).
 *
 * Account creation goes through the standard client `signIn("password", { flow:
 * "signUp" })` path. Domain profiles are attached afterwards, explicitly and
 * idempotently:
 *   - Managers call `managers.ensureProfile` (creates a `propertyManagers` row).
 *   - Tenants call `invites.link` (links the new `users` row to a pre-existing
 *     `tenants` row and marks the invite accepted, single-use).
 *
 * Security hardening (audit 2026-07): SecurePassword adds server-side validation,
 * rate limits, account lockout, progressive delay, generic errors, Scrypt hashing
 * with legacy rehash, and password-reset email (Resend or stub).
 *
 * `signIn.maxFailedAttempsPerHour` complements our lockout table as a second
 * built-in brake inside Convex Auth's OTP/credentials helpers.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [SecurePassword()],
  signIn: {
    // Built-in Convex Auth throttle (per identifier / hour). Our authLockouts
    // table enforces the stricter 5-failure → 15-minute lockout policy.
    maxFailedAttempsPerHour: 10,
  },
  session: {
    totalDurationMs: 1000 * 60 * 60 * 24 * 30,
    inactiveDurationMs: 1000 * 60 * 60 * 24 * 7,
  },
  jwt: {
    durationMs: 1000 * 60 * 60,
  },
  callbacks: {
    async redirect({ redirectTo }) {
      // Open-redirect guard: only relative paths or SITE_URL prefix.
      const site = process.env.SITE_URL ?? "";
      if (redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
        return redirectTo;
      }
      if (site && redirectTo.startsWith(site)) {
        return redirectTo;
      }
      return site || "/";
    },
  },
});
