/**
 * Account lockout + progressive delay helpers (auth security §2).
 *
 * Counters live in `authLockouts` (Convex transactional store via the rate
 * limiter component for IP/email throttles). There is no Redis/Upstash in this
 * project; `@convex-dev/rate-limiter` is the durable multi-instance equivalent.
 */

export const LOCKOUT_MAX_FAILURES = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
/** Cap progressive delay so auth actions stay within reasonable runtimes. */
export const PROGRESSIVE_DELAY_CAP_MS = 8_000;

export function progressiveDelayMs(failureCount: number): number {
  if (failureCount <= 0) return 0;
  // 250ms, 500ms, 1s, 2s, ... capped
  const ms = 250 * Math.pow(2, Math.min(failureCount - 1, 5));
  return Math.min(ms, PROGRESSIVE_DELAY_CAP_MS);
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}
