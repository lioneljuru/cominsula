import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Convex data model for Cominsula.io (PRD v3.0 §5 + Addendum v3.1).
 *
 * Conventions:
 *  - Field names are camelCase (Convex convention); they map 1:1 to the PRD's
 *    snake_case fields.
 *  - Calendar dates (billing cycles, lease/due dates) are stored as ISO
 *    "YYYY-MM-DD" strings for stable, timezone-free date math.
 *  - Timestamps (createdAt, calculatedAt, expiresAt, acceptedAt) are epoch ms.
 *  - Money is stored as a number of minor-unit-agnostic decimal value; no
 *    currency symbol/region is ever encoded (PRD §11).
 *  - `managerId` is denormalized onto child rows purely so the RLS layer
 *    (convex/lib/rls.ts) can scope every table without deep joins. It is set
 *    once at write time, validated against the invariant in §5.5, and never
 *    mutated (Fix #5).
 */
export const subscriptionTierValidator = v.union(
  v.literal("free"),
  v.literal("standard"),
  v.literal("premium"),
);

export const inviteStatusValidator = v.union(
  v.literal("invited"),
  v.literal("active"),
  v.literal("removed"),
);

export const riskTierValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("unrated"),
);

export const scoreTriggerValidator = v.union(
  v.literal("payment_recorded"),
  v.literal("manual_recalculate"),
  v.literal("unit_transfer"),
);

export const actorTypeValidator = v.union(
  v.literal("manager"),
  v.literal("tenant"),
  v.literal("system"),
);

export default defineSchema({
  // Convex Auth tables (users, authSessions, authAccounts, ...).
  ...authTables,

  // §5.1 — a manager domain profile linked to an auth user.
  propertyManagers: defineTable({
    userId: v.id("users"),
    email: v.string(),
    fullName: v.string(),
    subscriptionTier: subscriptionTierValidator,
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"]),

  // §5.2
  properties: defineTable({
    managerId: v.id("propertyManagers"),
    name: v.string(),
    address: v.string(),
    createdAt: v.number(),
  }).index("by_manager", ["managerId"]),

  // §5.3 — `status` is NOT stored; it is derived from active assignments.
  units: defineTable({
    propertyId: v.id("properties"),
    managerId: v.id("propertyManagers"),
    label: v.string(),
    monthlyRent: v.number(),
    createdAt: v.number(),
  })
    .index("by_property", ["propertyId"])
    .index("by_manager", ["managerId"]),

  // §5.4 — `managerId` immutable after creation (Fix #5).
  tenants: defineTable({
    managerId: v.id("propertyManagers"),
    authUserId: v.optional(v.id("users")),
    fullName: v.string(),
    email: v.string(),
    phoneNumber: v.string(),
    inviteStatus: inviteStatusValidator,
    createdAt: v.number(),
  })
    .index("by_manager", ["managerId"])
    .index("by_authUser", ["authUserId"])
    .index("by_email", ["email"]),

  // §5.4b — first-class, closeable/re-openable lease assignment.
  // `active` mirrors "leaseEndDate IS NULL" so partial-unique invariants
  // (one active assignment per tenant, one per unit) are index-checkable.
  tenantUnitAssignments: defineTable({
    tenantId: v.id("tenants"),
    unitId: v.id("units"),
    managerId: v.id("propertyManagers"),
    propertyId: v.id("properties"),
    rentDueAmount: v.number(),
    dueDayOfMonth: v.number(),
    leaseStartDate: v.string(),
    leaseEndDate: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_unit", ["unitId"])
    .index("by_manager", ["managerId"])
    .index("by_property", ["propertyId"])
    .index("by_tenant_active", ["tenantId", "active"])
    .index("by_unit_active", ["unitId", "active"]),

  // §5.5 — one Charge per (assignment, billingCycle).
  charges: defineTable({
    assignmentId: v.id("tenantUnitAssignments"),
    tenantId: v.id("tenants"),
    managerId: v.id("propertyManagers"),
    billingCycle: v.string(),
    amountDue: v.number(),
    dueDate: v.string(),
    createdAt: v.number(),
  })
    .index("by_assignment", ["assignmentId"])
    .index("by_assignment_cycle", ["assignmentId", "billingCycle"])
    .index("by_tenant", ["tenantId"])
    .index("by_manager", ["managerId"]),

  // §5.6 — installments against a Charge (may be partial).
  payments: defineTable({
    chargeId: v.id("charges"),
    tenantId: v.id("tenants"),
    managerId: v.id("propertyManagers"),
    amountPaid: v.number(),
    datePaid: v.string(),
    createdAt: v.number(),
  })
    .index("by_charge", ["chargeId"])
    .index("by_tenant", ["tenantId"])
    .index("by_manager", ["managerId"]),

  // §5.7 — append-only score history.
  tenantScoreSnapshots: defineTable({
    tenantId: v.id("tenants"),
    managerId: v.id("propertyManagers"),
    score: v.union(v.number(), v.null()),
    riskTier: riskTierValidator,
    cyclesUsed: v.number(),
    calculatedAt: v.number(),
    trigger: scoreTriggerValidator,
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_calculatedAt", ["tenantId", "calculatedAt"]),

  // §5.8 — single-use, time-boxed invite; only the hash is stored.
  tenantInvites: defineTable({
    tenantId: v.id("tenants"),
    managerId: v.id("propertyManagers"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_tenant", ["tenantId"]),

  // §5.9 — immutable, single-state legal record.
  notices: defineTable({
    tenantId: v.id("tenants"),
    managerId: v.id("propertyManagers"),
    body: v.string(),
    snapshotId: v.optional(v.id("tenantScoreSnapshots")),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_manager", ["managerId"]),

  // Addendum A1 — cheap, human-readable activity trail.
  auditLogs: defineTable({
    managerId: v.id("propertyManagers"),
    tenantId: v.optional(v.id("tenants")),
    propertyId: v.optional(v.id("properties")),
    actorType: actorTypeValidator,
    actorId: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    summary: v.string(),
    createdAt: v.number(),
  })
    .index("by_manager", ["managerId", "createdAt"])
    .index("by_tenant", ["tenantId", "createdAt"])
    .index("by_property", ["propertyId", "createdAt"]),
});
