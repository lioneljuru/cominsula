/**
 * Coarse browser-scoped key used as a stand-in for IP rate limiting on Convex
 * Auth actions (which do not expose the client IP). Not a security boundary —
 * edge/CDN IP limits should still be applied in production.
 */
const STORAGE_KEY = "cominsula_rlk";

export function getClientRateLimitKey(): string {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 16) return existing;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(STORAGE_KEY, key);
    return key;
  } catch {
    return "anon";
  }
}

export const AUTH_UI_MESSAGES = {
  loginFailure: "Incorrect email or password",
  passwordResetRequest:
    "If that email is registered, you'll receive a reset link",
  registrationPending: "Check your email to complete registration",
  validationFailed: "Invalid request",
} as const;

/** Best-effort extract of ConvexError / Error message without leaking stacks. */
export function authErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === "object" && data !== null && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    if (typeof data === "string") return data;
  }
  if (err instanceof Error) return err.message;
  return "";
}
