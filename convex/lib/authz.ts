import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { Principal } from "./principal";
import { errForbidden, errUnauthenticated } from "./errors";

/**
 * Identity resolution (plan: RLS layer 1 - the auth gate).
 *
 * These helpers run against the RAW `ctx.db` because they resolve *who* the
 * caller is before any scoped db exists. Everything downstream then uses the
 * RLS-wrapped db built from the returned `Principal`.
 */

export async function currentUserId(
  ctx: QueryCtx,
): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

export async function resolveManager(
  ctx: QueryCtx,
): Promise<{ manager: Doc<"propertyManagers">; principal: Principal }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) errUnauthenticated();
  const manager = await ctx.db
    .query("propertyManagers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!manager) errForbidden("This account is not a property manager");
  return {
    manager,
    principal: { kind: "manager", userId, managerId: manager._id },
  };
}

export async function resolveTenant(
  ctx: QueryCtx,
): Promise<{ tenant: Doc<"tenants">; principal: Principal }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) errUnauthenticated();
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_authUser", (q) => q.eq("authUserId", userId))
    .unique();
  if (!tenant) errForbidden("This account is not a tenant");
  if (tenant.inviteStatus === "removed") {
    errForbidden("This tenant account has been removed");
  }
  return {
    tenant,
    principal: {
      kind: "tenant",
      userId,
      tenantId: tenant._id,
      managerId: tenant.managerId,
    },
  };
}
