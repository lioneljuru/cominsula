import { v } from "convex/values";
import { managerQuery, managerMutation } from "./lib/functions";
import { errNotFound } from "./lib/errors";
import { writeAudit } from "./lib/audit";
import { logInfo } from "./lib/log";

/** POST /units - add a unit to one of the manager's properties. */
export const create = managerMutation({
  args: {
    propertyId: v.id("properties"),
    label: v.string(),
    monthlyRent: v.number(),
  },
  handler: async (ctx, { propertyId, label, monthlyRent }) => {
    const property = await ctx.db.get(propertyId);
    if (!property) errNotFound("Property not found");
    const unitId = await ctx.db.insert("units", {
      propertyId,
      managerId: ctx.manager._id,
      label,
      monthlyRent,
      createdAt: Date.now(),
    });
    await writeAudit(ctx.db, {
      managerId: ctx.manager._id,
      propertyId,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "unit",
      entityId: unitId,
      action: "created",
      summary: `Added unit "${label}"`,
    });
    logInfo({ event: "unit_created", fn: "units.create", managerId: ctx.manager._id, unitId });
    return await ctx.db.get(unitId);
  },
});

/**
 * PATCH /units/{id} (Addendum A4). `monthlyRent` only changes the unit's default
 * for FUTURE assignments; it never touches an existing Charge, whose amountDue
 * was snapshotted at creation (§5.5).
 */
export const update = managerMutation({
  args: {
    unitId: v.id("units"),
    label: v.optional(v.string()),
    monthlyRent: v.optional(v.number()),
  },
  handler: async (ctx, { unitId, label, monthlyRent }) => {
    const unit = await ctx.db.get(unitId);
    if (!unit) errNotFound("Unit not found");
    const patch: { label?: string; monthlyRent?: number } = {};
    if (label !== undefined) patch.label = label;
    if (monthlyRent !== undefined) patch.monthlyRent = monthlyRent;
    await ctx.db.patch(unitId, patch);
    await writeAudit(ctx.db, {
      managerId: ctx.manager._id,
      propertyId: unit.propertyId,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "unit",
      entityId: unitId,
      action: "updated",
      summary: `Updated unit "${unit.label}"`,
    });
    return await ctx.db.get(unitId);
  },
});

/** Unit detail with derived (never stored) occupancy status (§5.3 / §5.4b). */
export const get = managerQuery({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    const unit = await ctx.db.get(unitId);
    if (!unit) errNotFound("Unit not found");
    const activeAssignment = await ctx.db
      .query("tenantUnitAssignments")
      .withIndex("by_unit_active", (q) =>
        q.eq("unitId", unitId).eq("active", true),
      )
      .unique();
    return {
      ...unit,
      status: activeAssignment ? "occupied" : "vacant",
      activeAssignment,
    };
  },
});
