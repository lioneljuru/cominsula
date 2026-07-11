import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Convex Auth (PRD §10: Supabase Auth is replaced by Convex Auth email/password).
 *
 * Account creation goes through the standard client `signIn("password", { flow:
 * "signUp" })` path. Domain profiles are attached afterwards, explicitly and
 * idempotently:
 *   - Managers call `managers.ensureProfile` (creates a `propertyManagers` row).
 *   - Tenants call `invites.link` (links the new `users` row to a pre-existing
 *     `tenants` row and marks the invite accepted, single-use).
 *
 * This keeps auth on the supported client flow while all token validation and
 * cross-tenant linkage stay in transactional mutations.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        return { email: params.email as string };
      },
    }),
  ],
});
