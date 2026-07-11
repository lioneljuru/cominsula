import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { managerQuery, managerMutation } from "./lib/functions";
import { enforceTenantLimit } from "./lib/limits";
import { errNotFound, errConflict, errForbidden } from "./lib/errors";
import { writeAudit } from "./lib/audit";
import { latestSnapshot, recomputeAndSnapshot } from "./lib/scoreEngine";
import { generateInviteToken, hashInviteToken } from "./lib/crypto";
import { todayISO } from "./lib/dates";
import { logInfo } from "./lib/log";
import type { Doc, Id } from "./_generated/dataModel";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function activeAssignmentForTenant(
  db: import("./_generated/server").DatabaseReader,
  tenantId: Id<"tenants">,
): Promise<Doc<"tenantUnitAssignments"> | null> {
  return await db
    .query("tenantUnitAssignments")
    .withIndex("by_tenant_active", (q) =>
      q.eq("tenantId", tenantId).eq("active", true),
    )
    .unique();
}

/**
 * POST /tenants (§7.1). One transaction: create the tenant, open its first
 * assignment, and mint a single-use invite. Enforces the per-property tenant
 * limit and the "one active tenant per unit" invariant. Returns the raw invite
 * token exactly once (only its hash is stored).
 */
export const create = managerMutation({
  args: {
    unitId: v.id("units"),
    fullName: v.string(),
    email: v.string(),
    phoneNumber: v.string(),
    leaseStartDate: v.string(),
    rentDueAmount: v.number(),
    dueDayOfMonth: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.dueDayOfMonth < 1 || args.dueDayOfMonth > 31) {
      errConflict("due_day_of_month must be between 1 and 31");
    }
    const unit = await ctx.db.get(args.unitId);
    if (!unit) errNotFound("Unit not found in your portfolio");

    // One active tenant per unit (§5.4b).
    const occupied = await ctx.db
      .query("tenantUnitAssignments")
      .withIndex("by_unit_active", (q) =>
        q.eq("unitId", args.unitId).eq("active", true),
      )
      .unique();
    if (occupied) errConflict("Unit already has an active tenant");

    // Per-property tenant limit (§6.4), atomic under serializable OCC.
    await enforceTenantLimit(ctx.db, ctx.manager, unit.propertyId);

    const now = Date.now();
    const tenantId = await ctx.db.insert("tenants", {
      managerId: ctx.manager._id,
      fullName: args.fullName,
      email: args.email,
      phoneNumber: args.phoneNumber,
      inviteStatus: "invited",
      createdAt: now,
    });

    const assignmentId = await ctx.db.insert("tenantUnitAssignments", {
      tenantId,
      unitId: args.unitId,
      managerId: ctx.manager._id,
      propertyId: unit.propertyId,
      rentDueAmount: args.rentDueAmount,
      dueDayOfMonth: args.dueDayOfMonth,
      leaseStartDate: args.leaseStartDate,
      leaseEndDate: undefined,
      active: true,
      createdAt: now,
    });

    const rawToken = generateInviteToken();
    await ctx.db.insert("tenantInvites", {
      tenantId,
      managerId: ctx.manager._id,
      tokenHash: hashInviteToken(rawToken),
      expiresAt: now + INVITE_TTL_MS,
      createdAt: now,
    });

    await writeAudit(ctx.db, {
      managerId: ctx.manager._id,
      tenantId,
      propertyId: unit.propertyId,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "tenant",
      entityId: tenantId,
      action: "created",
      summary: `Invited tenant ${args.fullName} to unit "${unit.label}"`,
    });
    logInfo({ event: "tenant_created", fn: "tenants.create", managerId: ctx.manager._id, tenantId });

    const tenant = await ctx.db.get(tenantId);
    const assignment = await ctx.db.get(assignmentId);
    return {
      tenant,
      assignment,
      invite_status: "invited" as const,
      invite_token: rawToken,
    };
  },
});

/** GET /tenants - manager-facing list of all tenants, paginated (design v2 open item 1). */
export const list = managerQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    return await ctx.db
      .query("tenants")
      .withIndex("by_manager", (q) => q.eq("managerId", ctx.manager._id))
      .order("desc")
      .paginate(paginationOpts);
  },
});

/** GET /tenants/{id} - profile + current lease + latest score (§7.12). */
export const get = managerQuery({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) errNotFound("Tenant not found");
    const assignment = await activeAssignmentForTenant(ctx.db, tenantId);
    const unit = assignment ? await ctx.db.get(assignment.unitId) : null;
    const property = unit ? await ctx.db.get(unit.propertyId) : null;
    const snapshot = await latestSnapshot(ctx.db, tenantId);
    return {
      tenant,
      assignment,
      unit,
      property,
      score: snapshot
        ? { score: snapshot.score, riskTier: snapshot.riskTier, asOf: snapshot.calculatedAt }
        : { score: null, riskTier: "unrated" as const, asOf: null },
    };
  },
});

/**
 * PATCH /tenants/{id} (Addendum A4). Whitelisted to non-invariant, non-financial
 * fields. `managerId`, `email`, `inviteStatus`, and any unit link are explicitly
 * excluded (Fix #5 immutability enforced here, not just documented).
 */
export const update = managerMutation({
  args: {
    tenantId: v.id("tenants"),
    fullName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
  },
  handler: async (ctx, { tenantId, fullName, phoneNumber }) => {
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) errNotFound("Tenant not found");
    const patch: { fullName?: string; phoneNumber?: string } = {};
    if (fullName !== undefined) patch.fullName = fullName;
    if (phoneNumber !== undefined) patch.phoneNumber = phoneNumber;
    await ctx.db.patch(tenantId, patch);
    await writeAudit(ctx.db, {
      managerId: ctx.manager._id,
      tenantId,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "tenant",
      entityId: tenantId,
      action: "updated",
      summary: `Updated tenant profile`,
    });
    return await ctx.db.get(tenantId);
  },
});

/**
 * POST /tenants/{id}/transfer (§7.2, Fix #11). Closes the current assignment and
 * opens a new one on a different unit in ONE transaction, validating the target
 * unit belongs to the tenant's (immutable) manager. Preserves the tenant's
 * identity and continuous score history.
 */
export const transfer = managerMutation({
  args: {
    tenantId: v.id("tenants"),
    newUnitId: v.id("units"),
    rentDueAmount: v.number(),
    dueDayOfMonth: v.number(),
    effectiveDate: v.string(),
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) errNotFound("Tenant not found");

    const newUnit = await ctx.db.get(args.newUnitId);
    // RLS already guarantees the unit is in this manager's portfolio; the
    // explicit invariant re-check (Fix #5) makes the guarantee load-bearing.
    if (!newUnit || newUnit.managerId !== tenant.managerId) {
      errForbidden("Target unit is not in this manager's portfolio");
    }

    const targetOccupied = await ctx.db
      .query("tenantUnitAssignments")
      .withIndex("by_unit_active", (q) =>
        q.eq("unitId", args.newUnitId).eq("active", true),
      )
      .unique();
    if (targetOccupied) errConflict("Target unit already has an active tenant");

    const current = await activeAssignmentForTenant(ctx.db, args.tenantId);
    if (current) {
      await ctx.db.patch(current._id, {
        active: false,
        leaseEndDate: args.effectiveDate,
      });
    }

    const now = Date.now();
    const newAssignmentId = await ctx.db.insert("tenantUnitAssignments", {
      tenantId: args.tenantId,
      unitId: args.newUnitId,
      managerId: tenant.managerId,
      propertyId: newUnit.propertyId,
      rentDueAmount: args.rentDueAmount,
      dueDayOfMonth: args.dueDayOfMonth,
      leaseStartDate: args.effectiveDate,
      leaseEndDate: undefined,
      active: true,
      createdAt: now,
    });

    await recomputeAndSnapshot(ctx.db, {
      managerId: tenant.managerId,
      tenantId: args.tenantId,
      trigger: "unit_transfer",
    });

    await writeAudit(ctx.db, {
      managerId: ctx.manager._id,
      tenantId: args.tenantId,
      propertyId: newUnit.propertyId,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "unit_assignment",
      entityId: newAssignmentId,
      action: "transferred",
      summary: `Transferred tenant to unit "${newUnit.label}"`,
    });
    logInfo({ event: "tenant_transferred", fn: "tenants.transfer", managerId: ctx.manager._id, tenantId: args.tenantId });

    return {
      closed_assignment: current ? await ctx.db.get(current._id) : null,
      new_assignment: await ctx.db.get(newAssignmentId),
    };
  },
});

/**
 * DELETE /tenants/{id} (§6.5, Fix #7). Soft-removal in one transaction: mark
 * removed, close the active assignment (frees the unit + subscription capacity),
 * revoke any auth session. Financial/score/notice history is retained (§10).
 */
export const remove = managerMutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) errNotFound("Tenant not found");

    await ctx.db.patch(tenantId, { inviteStatus: "removed" });

    const current = await activeAssignmentForTenant(ctx.db, tenantId);
    if (current) {
      await ctx.db.patch(current._id, {
        active: false,
        leaseEndDate: todayISO(),
      });
    }

    // Revoke sessions (raw db - auth tables are outside the scoped boundary).
    if (tenant.authUserId) {
      const sessions = await ctx.rawDb
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", tenant.authUserId!))
        .collect();
      for (const session of sessions) {
        await ctx.rawDb.delete(session._id);
      }
    }

    await writeAudit(ctx.db, {
      managerId: ctx.manager._id,
      tenantId,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "tenant",
      entityId: tenantId,
      action: "removed",
      summary: `Removed tenant ${tenant.fullName}`,
    });
    logInfo({ event: "tenant_removed", fn: "tenants.remove", managerId: ctx.manager._id, tenantId });

    return { removed: true };
  },
});

/** GET /tenants/{id}/activity - paginated audit trail (Addendum A1). */
export const activity = managerQuery({
  args: {
    tenantId: v.id("tenants"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { tenantId, paginationOpts }) => {
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) errNotFound("Tenant not found");
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .order("desc")
      .paginate(paginationOpts);
  },
});
