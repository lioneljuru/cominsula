import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Resolve the authenticated user's role without throwing. Used by the SPA to
 * route managers vs tenants vs freshly-registered users who still need a profile.
 */
export const role = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { kind: "anonymous" as const };

    const manager = await ctx.db
      .query("propertyManagers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (manager) {
      return { kind: "manager" as const, managerId: manager._id };
    }

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_authUser", (q) => q.eq("authUserId", userId))
      .unique();
    if (tenant) {
      if (tenant.inviteStatus === "removed") {
        return { kind: "removed_tenant" as const };
      }
      return { kind: "tenant" as const, tenantId: tenant._id };
    }

    return { kind: "registered" as const, userId };
  },
});
