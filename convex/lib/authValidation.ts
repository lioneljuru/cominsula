/**
 * Server-side auth input validation & sanitization.
 *
 * Intentionally dependency-free (no Zod) to match the rest of the Convex
 * backend's lightweight validation style. Validation failures throw a generic
 * client-facing error; structured details are logged server-side without
 * credential values.
 */

import { ConvexError } from "convex/values";
import { logWarn } from "./log";

/** Generic message returned for any auth-field validation failure. */
export const AUTH_VALIDATION_FAILED = "Invalid request";

export const AUTH_MESSAGES = {
  loginFailure: "Incorrect email or password",
  passwordResetRequest:
    "If that email is registered, you'll receive a reset link",
  registrationPending: "Check your email to complete registration",
  validationFailed: AUTH_VALIDATION_FAILED,
} as const;

const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const DISPLAY_NAME_MIN = 1;
const DISPLAY_NAME_MAX = 100;

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** Strip HTML / script-like content and control characters. */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>`'"]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

function failValidation(
  field: string,
  rule: string,
  meta?: { ip?: string },
): never {
  logWarn({
    event: "auth_validation_failed",
    fn: "authValidation",
    field,
    rule,
    tsClient: Date.now(),
    ip: meta?.ip ?? null,
  });
  throw new ConvexError({
    code: "INVALID_INPUT",
    message: AUTH_VALIDATION_FAILED,
    upgradeRequired: false,
    detail: null,
  });
}

export function validateAndNormalizeEmail(
  raw: unknown,
  meta?: { ip?: string },
): string {
  if (typeof raw !== "string") failValidation("email", "type", meta);
  const sanitized = sanitizeText(raw).toLowerCase();
  if (!sanitized) failValidation("email", "required", meta);
  if (sanitized.length > EMAIL_MAX) failValidation("email", "max_length", meta);
  if (!EMAIL_RE.test(sanitized)) failValidation("email", "format", meta);
  return sanitized;
}

export function validatePassword(
  raw: unknown,
  meta?: { ip?: string },
): string {
  if (typeof raw !== "string") failValidation("password", "type", meta);
  // Do not strip characters from passwords — only length/emptiness checks.
  if (raw.length < PASSWORD_MIN) failValidation("password", "min_length", meta);
  if (raw.length > PASSWORD_MAX) failValidation("password", "max_length", meta);
  if (/[\u0000-\u001F\u007F]/.test(raw)) {
    failValidation("password", "control_chars", meta);
  }
  return raw;
}

export function validateDisplayName(
  raw: unknown,
  meta?: { ip?: string },
): string {
  if (typeof raw !== "string") failValidation("fullName", "type", meta);
  const sanitized = sanitizeText(raw);
  if (sanitized.length < DISPLAY_NAME_MIN) {
    failValidation("fullName", "min_length", meta);
  }
  if (sanitized.length > DISPLAY_NAME_MAX) {
    failValidation("fullName", "max_length", meta);
  }
  return sanitized;
}

/** Coarse client rate-limit key (never trust as proof of IP). */
export function validateRateLimitKey(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return undefined;
  const cleaned = sanitizeText(raw).slice(0, 128);
  return cleaned || undefined;
}
