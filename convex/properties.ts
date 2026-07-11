import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { managerQuery, managerMutation } from "./lib/functions";
import { enforcePropertyLimit } from "./lib/limits";
import { errNotFound } from "./lib/errors";
import { writeAudit } from "./lib/audit";
import { latestSnapshot } from "./lib/scoreEngine";
import { logInfo } from "./lib/log";
import type { Id } from "./_generated/dataModel";

/** GET /properties - paginated (§7.12, Fix #10). */
export const list = managerQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    return await ctx.db
      .query("properties")
      .withIndex("by_manager", (q) => q.eq("managerId", ctx.manager._id))
      .order("desc")
      .paginate(paginationOpts);
  },
});

/** POST /properties - creates a property, subscription-limit checked (§6.4). */
export const create = managerMutation({
  args: { name: v.string(), address: v.string() },
  handler: async (ctx, { name, address }) => {
    await enforcePropertyLimit(ctx.db, ctx.manager);
    const propertyId = await ctx.db.insert("properties", {
      managerId: ctx.manager._id,
      name,
      address,
      createdAt: Date.now(),
    });
    await writeAudit(ctx.db, {
      managerId: ctx.manager._id,
      propertyId,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "property",
      entityId: propertyId,
      action: "created",
      summary: `Created property "${name}"`,
    });
    logInfo({ event: "property_created", fn: "properties.create", managerId: ctx.manager._id, propertyId });
    return await ctx.db.get(propertyId);
  },
});

/** PATCH /properties/{id} - safe edit of non-invariant fields (Addendum A4). */
export const update = managerMutation({
  args: {
    propertyId: v.id("properties"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, { propertyId, name, address }) => {
    const property = await ctx.db.get(propertyId);
    if (!property) errNotFound("Property not found");
    const patch: { name?: string; address?: string } = {};
    if (name !== undefined) patch.name = name;
    if (address !== undefined) patch.address = address;
    await ctx.db.patch(propertyId, patch);
    await writeAudit(ctx.db, {
      managerId: ctx.manager._id,
      propertyId,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "property",
      entityId: propertyId,
      action: "updated",
      summary: `Updated property details`,
    });
    return await ctx.db.get(propertyId);
  },
});

/** GET /properties/{id} - overview with units + occupying tenant summaries (§7.6). */
export const overview = managerQuery({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    const property = await ctx.db.get(propertyId);
    if (!property) errNotFound("Property not found");

    const units = await ctx.db
      .query("units")
      .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
      .collect();

    const unitViews = [];
    for (const unit of units) {
      const activeAssignment = await ctx.db
        .query("tenantUnitAssignments")
        .withIndex("by_unit_active", (q) =>
          q.eq("unitId", unit._id).eq("active", true),
        )
        .unique();

      let tenantSummary: {
        tenantId: Id<"tenants">;
        name: string;
        score: number | null;
        riskTier: string;
      } | null = null;

      if (activeAssignment) {
        const tenant = await ctx.db.get(activeAssignment.tenantId);
        if (tenant) {
          const snapshot = await latestSnapshot(ctx.db, tenant._id);
          tenantSummary = {
            tenantId: tenant._id,
            name: tenant.fullName,
            score: snapshot?.score ?? null,
            riskTier: snapshot?.riskTier ?? "unrated",
          };
        }
      }

      unitViews.push({
        ...unit,
        status: activeAssignment ? "occupied" : "vacant",
        rentDueAmount: activeAssignment?.rentDueAmount ?? null,
        tenant: tenantSummary,
      });
    }

    return { property, units: unitViews };
  },
});

/** GET /properties/{id}/activity - paginated audit trail (Addendum A1). */
export const activity = managerQuery({
  args: {
    propertyId: v.id("properties"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { propertyId, paginationOpts }) => {
    // Ownership enforced by RLS: a foreign property returns null here.
    const property = await ctx.db.get(propertyId);
    if (!property) errNotFound("Property not found");
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
      .order("desc")
      .paginate(paginationOpts);
  },
});
