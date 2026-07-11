import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { managerQuery, managerMutation } from "./lib/functions";
import { subscriptionTierValidator } from "./schema";
import { TIER_LIMITS, type SubscriptionTier } from "@cominsula/shared";
import {
  errUnauthenticated,
  errForbidden,
  errDowngradeBlocked,
} from "./lib/errors";
import { countProperties } from "./lib/limits";
import { writeAudit } from "./lib/audit";
import { logInfo } from "./lib/log";

/**
 * Create the manager domain profile for the currently authenticated user
 * (called by the client right after `signUp`). Idempotent. Refuses if the user
 * is already linked to a tenant, so a tenant cannot self-promote to manager.
 */
export const ensureProfile = mutation({
  args: { fullName: v.string() },
  handler: async (ctx, { fullName }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) errUnauthenticated();

    const existingTenant = await ctx.db
      .query("tenants")
      .withIndex("by_authUser", (q) => q.eq("authUserId", userId))
      .unique();
    if (existingTenant) {
      errForbidden("This account is already registered as a tenant");
    }

    const existing = await ctx.db
      .query("propertyManagers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) return existing._id;

    const user = await ctx.db.get(userId);
    const email = user?.email ?? "";
    const managerId = await ctx.db.insert("propertyManagers", {
      userId,
      email,
      fullName,
      subscriptionTier: "free",
      createdAt: Date.now(),
    });
    logInfo({ event: "manager_registered", fn: "managers.ensureProfile", managerId });
    return managerId;
  },
});

/** The authenticated manager's own profile (§7). */
export const me = managerQuery({
  args: {},
  handler: async (ctx) => ctx.manager,
});

/** PATCH /account/profile — safe edit of manager display name (design v2 Settings gap). */
export const updateProfile = managerMutation({
  args: { fullName: v.string() },
  handler: async (ctx, { fullName }) => {
    const trimmed = fullName.trim();
    if (!trimmed) errForbidden("Full name cannot be empty");
    await ctx.db.patch(ctx.manager._id, { fullName: trimmed });
    await writeAudit(ctx.db, {
      managerId: ctx.manager._id,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "property_manager",
      entityId: ctx.manager._id,
      action: "updated",
      summary: "Updated manager profile",
    });
    return await ctx.db.get(ctx.manager._id);
  },
});

/** GET /limits (§7.8) - keyed by property (Fix #6). */
export const getLimits = managerQuery({
  args: {},
  handler: async (ctx) => {
    const tier = ctx.manager.subscriptionTier;
    const limits = TIER_LIMITS[tier];
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_manager", (q) => q.eq("managerId", ctx.manager._id))
      .collect();

    const tenantsByProperty: Record<
      string,
      { used: number; max: number }
    > = {};
    for (const property of properties) {
      const assignments = await ctx.db
        .query("tenantUnitAssignments")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .collect();
      tenantsByProperty[property._id] = {
        used: assignments.filter((a) => a.active).length,
        max: limits.tenantsPerProperty,
      };
    }

    return {
      tier,
      properties: {
        used: properties.length,
        max: limits.properties,
      },
      tenantsByProperty,
    };
  },
});

/** POST /account/tier (§7.9) - self-service, unmetered; blocks unsafe downgrade. */
export const setTier = managerMutation({
  args: { tier: subscriptionTierValidator },
  handler: async (ctx, { tier }) => {
    const target = TIER_LIMITS[tier as SubscriptionTier];

    const usedProperties = await countProperties(ctx.db, ctx.manager._id);
    if (Number.isFinite(target.properties) && usedProperties > target.properties) {
      errDowngradeBlocked(
        `Cannot downgrade: current usage (${usedProperties} properties) exceeds target tier limit (${target.properties})`,
        { usedProperties, maxProperties: target.properties },
      );
    }

    // Also block if any property exceeds the target per-property tenant limit.
    if (Number.isFinite(target.tenantsPerProperty)) {
      const properties = await ctx.db
        .query("properties")
        .withIndex("by_manager", (q) => q.eq("managerId", ctx.manager._id))
        .collect();
      for (const property of properties) {
        const assignments = await ctx.db
          .query("tenantUnitAssignments")
          .withIndex("by_property", (q) => q.eq("propertyId", property._id))
          .collect();
        const active = assignments.filter((a) => a.active).length;
        if (active > target.tenantsPerProperty) {
          errDowngradeBlocked(
            `Cannot downgrade: property "${property.name}" has ${active} tenants, exceeding target tier limit (${target.tenantsPerProperty})`,
            { active, max: target.tenantsPerProperty },
          );
        }
      }
    }

    await ctx.db.patch(ctx.manager._id, { subscriptionTier: tier });
    await writeAudit(ctx.db, {
      managerId: ctx.manager._id,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "property_manager",
      entityId: ctx.manager._id,
      action: "tier_changed",
      summary: `Changed subscription tier to ${tier}`,
    });
    logInfo({
      event: "tier_changed",
      fn: "managers.setTier",
      managerId: ctx.manager._id,
      tier,
    });
    return { subscriptionTier: tier };
  },
});
