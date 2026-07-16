/**
 * Internal mutations backing auth rate-limit + account lockout.
 * Called from the SecurePassword authorize action via ctx.runMutation.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { rateLimiter } from "./lib/rateLimiter";
import {
  LOCKOUT_DURATION_MS,
  LOCKOUT_MAX_FAILURES,
  progressiveDelayMs,
} from "./lib/authLockout";
import { logInfo, logWarn } from "./lib/log";

async function getLockout(
  db: import("./_generated/server").DatabaseReader,
  email: string,
) {
  return await db
    .query("authLockouts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
}

/** Pre-auth gate: IP + email rate limits and lockout check. */
export const preAuthGate = internalMutation({
  args: {
    email: v.string(),
    flow: v.string(),
    /** Client-supplied coarse key standing in for IP when available. */
    rateLimitKey: v.optional(v.string()),
  },
  handler: async (ctx, { email, flow, rateLimitKey }) => {
    const ipKey = rateLimitKey && rateLimitKey.length > 0 ? rateLimitKey : "unknown";

    if (flow === "signIn" || flow === "reset") {
      const byIp = await rateLimiter.limit(ctx, "authByIp", { key: ipKey });
      if (!byIp.ok) {
        logWarn({
          event: "auth_rate_limited",
          fn: "authSecurity.preAuthGate",
          scope: "ip",
          flow,
        });
        return {
          allowed: false as const,
          delayMs: 0,
          reason: "rate_limited" as const,
        };
      }
      const byEmail = await rateLimiter.limit(ctx, "authByEmail", { key: email });
      if (!byEmail.ok) {
        logWarn({
          event: "auth_rate_limited",
          fn: "authSecurity.preAuthGate",
          scope: "email",
          flow,
        });
        return {
          allowed: false as const,
          delayMs: 0,
          reason: "rate_limited" as const,
        };
      }
    }

    if (flow === "signIn") {
      const row = await getLockout(ctx.db, email);
      const now = Date.now();
      if (row?.lockedUntil && row.lockedUntil > now) {
        return {
          allowed: false as const,
          delayMs: progressiveDelayMs(row.failedCount),
          reason: "locked" as const,
        };
      }
      const delayMs = progressiveDelayMs(row?.failedCount ?? 0);
      return { allowed: true as const, delayMs, reason: null };
    }

    return { allowed: true as const, delayMs: 0, reason: null };
  },
});

/**
 * Record a failed sign-in. Returns whether a NEW lockout was just triggered
 * (so the caller can send a lockout email once).
 */
export const recordFailedSignIn = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const now = Date.now();
    const existing = await getLockout(ctx.db, email);
    if (existing?.lockedUntil && existing.lockedUntil > now) {
      return {
        locked: true,
        newlyLocked: false,
        failedCount: existing.failedCount,
        delayMs: progressiveDelayMs(existing.failedCount),
      };
    }

    const prevCount =
      existing && existing.lockedUntil && existing.lockedUntil <= now
        ? 0
        : (existing?.failedCount ?? 0);
    const failedCount = prevCount + 1;
    const newlyLocked = failedCount >= LOCKOUT_MAX_FAILURES;
    const lockedUntil = newlyLocked ? now + LOCKOUT_DURATION_MS : undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        failedCount,
        lockedUntil,
        lastFailedAt: now,
        lockoutEmailSentAt: newlyLocked ? existing.lockoutEmailSentAt : existing.lockoutEmailSentAt,
      });
    } else {
      await ctx.db.insert("authLockouts", {
        email,
        failedCount,
        lockedUntil,
        lastFailedAt: now,
      });
    }

    if (newlyLocked) {
      logInfo({
        event: "auth_account_locked",
        fn: "authSecurity.recordFailedSignIn",
        // email omitted from logs (PII); hash prefix only
        emailHashPrefix: email.slice(0, 2) + "***",
      });
    }

    return {
      locked: newlyLocked,
      newlyLocked,
      failedCount,
      delayMs: progressiveDelayMs(failedCount),
    };
  },
});

/** Mark lockout notification as sent so we don't spam. */
export const markLockoutEmailSent = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const row = await getLockout(ctx.db, email);
    if (!row) return;
    await ctx.db.patch(row._id, { lockoutEmailSentAt: Date.now() });
  },
});

export const clearFailures = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const row = await getLockout(ctx.db, email);
    if (row) await ctx.db.delete(row._id);
    await rateLimiter.reset(ctx, "authByEmail", { key: email });
  },
});

export const getLockoutState = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const row = await getLockout(ctx.db, email);
    if (!row) return null;
    return {
      failedCount: row.failedCount,
      lockedUntil: row.lockedUntil ?? null,
      lockoutEmailSentAt: row.lockoutEmailSentAt ?? null,
    };
  },
});
