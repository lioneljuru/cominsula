import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * Transactional rate limiting (PRD §6.7 + auth security audit §2).
 *
 * No Redis/Upstash in this project — `@convex-dev/rate-limiter` is a Convex
 * component backed by the same transactional store (multi-instance safe).
 *
 * Auth IP limiting uses a client-supplied coarse key (`rateLimitKey`) because
 * Convex Auth password flows run as Convex actions without a request IP.
 * Prefer putting a real edge/CDN IP limit in front for production.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Per-token acceptance attempts (brute-force protection on the token).
  inviteAccept: { kind: "fixed window", rate: 5, period: MINUTE },
  // Global safety valve across all acceptance attempts.
  inviteAcceptGlobal: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60 },
  // Auth: max 10 requests per IP-key per minute (login + password reset).
  authByIp: { kind: "fixed window", rate: 10, period: MINUTE },
  // Auth: max 10 requests per email per minute (enumeration / spray brake).
  authByEmail: { kind: "fixed window", rate: 10, period: MINUTE },
});
