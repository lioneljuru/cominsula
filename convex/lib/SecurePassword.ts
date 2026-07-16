/**
 * Hardened Password provider: validation, rate limits, lockout, progressive
 * delay, generic errors, Scrypt hashing with legacy rehash, and reset email.
 *
 * Built on ConvexCredentials (same surface as @convex-dev/auth Password) so we
 * can await security mutations inside authorize — Password.profile is sync-only.
 */

import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import {
  createAccount,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
  signInViaProvider,
} from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import {
  AUTH_MESSAGES,
  validateAndNormalizeEmail,
  validatePassword,
  validateRateLimitKey,
} from "./authValidation";
import {
  passwordCrypto,
  hashPassword,
  isLegacyWeakHash,
} from "./passwordCrypto";
import { sleep } from "./authLockout";
import { sendLockoutNotification } from "./authEmail";
import { PasswordResetEmail } from "../PasswordResetEmail";
import { logWarn } from "./log";

function loginFailure(): never {
  throw new ConvexError({
    code: "UNAUTHENTICATED",
    message: AUTH_MESSAGES.loginFailure,
    upgradeRequired: false,
    detail: null,
  });
}

function registrationPending(): never {
  throw new ConvexError({
    code: "CONFLICT",
    message: AUTH_MESSAGES.registrationPending,
    upgradeRequired: false,
    detail: null,
  });
}

export function SecurePassword() {
  const provider = "password";
  const reset = PasswordResetEmail;

  return ConvexCredentials({
    id: "password",
    crypto: passwordCrypto,
    extraProviders: [reset],
    authorize: async (params, ctx) => {
      const flow = params.flow as string | undefined;
      const rateLimitKey = validateRateLimitKey(params.rateLimitKey);
      const email = validateAndNormalizeEmail(params.email);

      if (flow === "signUp" || flow === "reset-verification") {
        validatePassword(
          flow === "signUp" ? params.password : params.newPassword,
        );
      } else if (flow === "signIn") {
        validatePassword(params.password);
      }

      if (flow === "signIn" || flow === "reset") {
        const gate = await ctx.runMutation(internal.authSecurity.preAuthGate, {
          email,
          flow,
          rateLimitKey,
        });
        if (gate.delayMs > 0) await sleep(gate.delayMs);
        if (!gate.allowed) {
          if (flow === "reset") {
            return null;
          }
          loginFailure();
        }
      }

      if (flow === "signUp") {
        const secret = params.password as string;
        try {
          const created = await createAccount(ctx, {
            provider,
            account: { id: email, secret },
            profile: { email },
            shouldLinkViaEmail: false,
            shouldLinkViaPhone: false,
          });
          return { userId: created.user._id };
        } catch {
          logWarn({
            event: "auth_signup_rejected",
            fn: "SecurePassword",
            reason: "create_failed",
          });
          await hashPassword("timing-pad-" + email.length);
          registrationPending();
        }
      }

      if (flow === "signIn") {
        const secret = params.password as string;
        const retrieved = await retrieveAccount(ctx, {
          provider,
          account: { id: email, secret },
        });
        if (retrieved === null) {
          const failure = await ctx.runMutation(
            internal.authSecurity.recordFailedSignIn,
            { email },
          );
          if (failure.delayMs > 0) await sleep(failure.delayMs);
          if (failure.newlyLocked) {
            const state = await ctx.runQuery(
              internal.authSecurity.getLockoutState,
              { email },
            );
            if (!state?.lockoutEmailSentAt) {
              await sendLockoutNotification({ to: email });
              await ctx.runMutation(internal.authSecurity.markLockoutEmailSent, {
                email,
              });
            }
          }
          loginFailure();
        }

        const storedSecret = (retrieved.account as { secret?: string }).secret;
        if (typeof storedSecret === "string" && isLegacyWeakHash(storedSecret)) {
          await modifyAccountCredentials(ctx, {
            provider,
            account: { id: email, secret },
          });
        }

        await ctx.runMutation(internal.authSecurity.clearFailures, { email });
        return { userId: retrieved.user._id };
      }

      if (flow === "reset") {
        try {
          const { account } = await retrieveAccount(ctx, {
            provider,
            account: { id: email },
          });
          await signInViaProvider(ctx, reset, {
            accountId: account._id,
            params,
          });
        } catch {
          await hashPassword("reset-pad-" + email.length);
        }
        return null;
      }

      if (flow === "reset-verification") {
        if (params.newPassword === undefined) {
          loginFailure();
        }
        validatePassword(params.newPassword);
        let resetAccount;
        try {
          ({ account: resetAccount } = await retrieveAccount(ctx, {
            provider,
            account: { id: email },
          }));
        } catch {
          loginFailure();
        }
        const result = await signInViaProvider(ctx, reset, { params });
        if (result === null) loginFailure();
        const { userId, sessionId } = result;
        if (resetAccount!.userId !== userId) loginFailure();
        await modifyAccountCredentials(ctx, {
          provider,
          account: { id: email, secret: params.newPassword as string },
        });
        await invalidateSessions(ctx, { userId, except: [sessionId] });
        await ctx.runMutation(internal.authSecurity.clearFailures, { email });
        return { userId, sessionId };
      }

      throw new ConvexError({
        code: "INVALID_INPUT",
        message: AUTH_MESSAGES.validationFailed,
        upgradeRequired: false,
        detail: null,
      });
    },
  });
}
