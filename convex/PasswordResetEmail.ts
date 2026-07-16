/**
 * Auth.js-compatible email provider for Convex Auth password reset OTPs.
 * Delivers via Resend when AUTH_RESEND_KEY is set; otherwise stubs (logs only).
 */

import Resend from "@auth/core/providers/resend";
import { sendPasswordResetEmail } from "./lib/authEmail";

function generateNumericOtp(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += String(bytes[i]! % 10);
  }
  return out;
}

export const PasswordResetEmail = Resend({
  id: "password-reset",
  apiKey: process.env.AUTH_RESEND_KEY ?? "stub",
  async generateVerificationToken() {
    return generateNumericOtp(8);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    await sendPasswordResetEmail({ to: email, code: token });
  },
});
