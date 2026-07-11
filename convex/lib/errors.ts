/**
 * Typed application errors (PRD §11: "every rejected request returns a typed
 * error code"; "no silent catch blocks").
 *
 * Convex propagates thrown `ConvexError` payloads to the client, so we carry a
 * machine-readable `code` plus flags the UI relies on (e.g. `upgradeRequired`).
 */
import { ConvexError } from "convex/values";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "LIMIT_REACHED"
  | "DOWNGRADE_BLOCKED"
  | "INVITE_INVALID"
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "INTERNAL";

export interface AppErrorData {
  code: AppErrorCode;
  message: string;
  /** Set on LIMIT_REACHED so the UI can surface an upgrade CTA. */
  upgradeRequired?: boolean;
  /** Optional structured detail (never contains secrets). */
  detail?: Record<string, string | number | boolean | null>;
}

export function appError(data: AppErrorData): never {
  // Build an explicitly Value-typed payload for ConvexError (no `undefined`).
  throw new ConvexError({
    code: data.code,
    message: data.message,
    upgradeRequired: data.upgradeRequired ?? false,
    detail: data.detail ?? null,
  });
}

// NOTE: these are `function` declarations, not arrow consts, on purpose:
// TypeScript only performs control-flow narrowing on `never`-returning function
// *declarations*, so `if (!x) errNotFound()` correctly narrows `x`.

export function errUnauthenticated(message = "Authentication required"): never {
  return appError({ code: "UNAUTHENTICATED", message });
}

export function errForbidden(message = "Permission denied"): never {
  return appError({ code: "FORBIDDEN", message });
}

export function errNotFound(message = "Not found"): never {
  return appError({ code: "NOT_FOUND", message });
}

export function errConflict(
  message: string,
  detail?: AppErrorData["detail"],
): never {
  return appError({ code: "CONFLICT", message, detail });
}

export function errLimitReached(message: string): never {
  return appError({ code: "LIMIT_REACHED", message, upgradeRequired: true });
}

export function errDowngradeBlocked(
  message: string,
  detail?: AppErrorData["detail"],
): never {
  return appError({ code: "DOWNGRADE_BLOCKED", message, detail });
}

export function errInviteInvalid(): never {
  // Generic message for both expired and already-used, to avoid account
  // enumeration (design v2 §8.5).
  return appError({
    code: "INVITE_INVALID",
    message: "Invite expired or already used",
  });
}

export function errInvalidInput(message: string): never {
  return appError({ code: "INVALID_INPUT", message });
}

export function errRateLimited(message = "Too many requests, slow down"): never {
  return appError({ code: "RATE_LIMITED", message });
}
