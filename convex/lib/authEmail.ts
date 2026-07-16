/**
 * Email notification hooks for auth security events.
 *
 * The project has no existing transactional email infra. When AUTH_RESEND_KEY
 * is set we send via Resend; otherwise we log a structured event so ops can
 * wire a provider later. Lockout emails must never include passwords or raw
 * reset tokens in logs.
 */

import { logInfo, logWarn } from "./log";

const FROM = process.env.AUTH_EMAIL_FROM ?? "Cominsula <security@cominsula.io>";
const SITE_URL = process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "";

export async function sendPasswordResetEmail(args: {
  to: string;
  code: string;
}): Promise<void> {
  const apiKey = process.env.AUTH_RESEND_KEY;
  const text = `Your Cominsula password reset code is ${args.code}. If you did not request this, you can ignore this email.`;

  if (!apiKey) {
    logWarn({
      event: "auth_email_stub",
      fn: "sendPasswordResetEmail",
      kind: "password_reset",
      // Deliberately omit email / code from logs (PII + secret).
      hasRecipient: true,
      note: "Set AUTH_RESEND_KEY to enable delivery",
    });
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [args.to],
        subject: "Reset your Cominsula password",
        text,
      }),
    });
    if (!res.ok) {
      logWarn({
        event: "auth_email_failed",
        fn: "sendPasswordResetEmail",
        status: res.status,
      });
      throw new Error("Could not send reset email");
    }
    logInfo({ event: "auth_email_sent", fn: "sendPasswordResetEmail", kind: "password_reset" });
  } catch (err) {
    logWarn({
      event: "auth_email_failed",
      fn: "sendPasswordResetEmail",
      error: err instanceof Error ? err.message : "unknown",
    });
    throw err;
  }
}

/** Notify the account holder that their account was locked after failed logins. */
export async function sendLockoutNotification(args: {
  to: string;
}): Promise<{ sent: boolean; stubbed: boolean }> {
  const resetPath = "/forgot-password";
  const resetUrl = SITE_URL ? `${SITE_URL.replace(/\/$/, "")}${resetPath}` : resetPath;
  const text =
    `We detected multiple failed sign-in attempts on your Cominsula account. ` +
    `For your security the account is temporarily locked. ` +
    `You can reset your password here: ${resetUrl}`;

  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) {
    logWarn({
      event: "auth_email_stub",
      fn: "sendLockoutNotification",
      kind: "lockout",
      hasRecipient: true,
      note: "Set AUTH_RESEND_KEY to enable delivery",
    });
    return { sent: false, stubbed: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [args.to],
        subject: "Cominsula account security notice",
        text,
      }),
    });
    if (!res.ok) {
      logWarn({
        event: "auth_email_failed",
        fn: "sendLockoutNotification",
        status: res.status,
      });
      return { sent: false, stubbed: false };
    }
    logInfo({ event: "auth_email_sent", fn: "sendLockoutNotification", kind: "lockout" });
    return { sent: true, stubbed: false };
  } catch (err) {
    logWarn({
      event: "auth_email_failed",
      fn: "sendLockoutNotification",
      error: err instanceof Error ? err.message : "unknown",
    });
    return { sent: false, stubbed: false };
  }
}
