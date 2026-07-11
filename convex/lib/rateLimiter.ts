import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * Transactional rate limiting for the anonymous invite surface (PRD §6.7 - the
 * system's real attack surface). No Redis: the limiter is a Convex component
 * backed by the same transactional store.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Per-token acceptance attempts (brute-force protection on the token).
  inviteAccept: { kind: "fixed window", rate: 5, period: MINUTE },
  // Global safety valve across all acceptance attempts.
  inviteAcceptGlobal: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60 },
});
