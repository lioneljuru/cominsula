import type { Rules } from "convex-helpers/server/rowLevelSecurity";
import type { DataModel } from "../_generated/dataModel";
import type { Principal } from "./principal";

/**
 * Declarative, data-layer row-level security (plan: emphasis 1).
 *
 * These rules are applied to a wrapped `ctx.db` inside every authenticated
 * query/mutation, so even a handler that forgets to scope its query cannot read
 * or write another tenant's rows. Combined with a `defaultPolicy: "deny"`, any
 * table without an explicit rule is inaccessible through the wrapped db.
 *
 * Immutable tables (charges, payments, score snapshots, notices, audit logs)
 * grant `insert` but deny `modify`, enforcing append-only semantics at the data
 * layer (Fix #1 / #3) - not merely by convention.
 */
export function rulesFor(p: Principal): Rules<unknown, DataModel> {
  const isManager = p.kind === "manager";
  const managerId = p.managerId;
  const tenantId = p.kind === "tenant" ? p.tenantId : null;

  /** Owned by the acting manager. */
  const ownedByManager = (doc: { managerId: Id_ }) =>
    isManager && doc.managerId === managerId;

  /** Readable by the manager who owns it, or the tenant it concerns. */
  const managerOrOwnTenant = (doc: { managerId: Id_; tenantId: Id_ }) =>
    ownedByManager(doc) || (tenantId !== null && doc.tenantId === tenantId);

  const allowManagerInsert = (doc: { managerId: Id_ }) =>
    isManager && doc.managerId === managerId;

  return {
    propertyManagers: {
      read: async (_ctx, doc) => isManager && doc._id === managerId,
      modify: async (_ctx, doc) => isManager && doc._id === managerId,
    },
    properties: {
      read: async (_ctx, doc) => ownedByManager(doc),
      insert: async (_ctx, doc) => allowManagerInsert(doc),
      modify: async (_ctx, doc) => ownedByManager(doc),
    },
    units: {
      read: async (_ctx, doc) => ownedByManager(doc),
      insert: async (_ctx, doc) => allowManagerInsert(doc),
      modify: async (_ctx, doc) => ownedByManager(doc),
    },
    tenants: {
      read: async (_ctx, doc) =>
        ownedByManager(doc) || (tenantId !== null && doc._id === tenantId),
      insert: async (_ctx, doc) => allowManagerInsert(doc),
      modify: async (_ctx, doc) => ownedByManager(doc),
    },
    tenantUnitAssignments: {
      read: async (_ctx, doc) => managerOrOwnTenant(doc),
      insert: async (_ctx, doc) => allowManagerInsert(doc),
      modify: async (_ctx, doc) => ownedByManager(doc),
    },
    charges: {
      read: async (_ctx, doc) => managerOrOwnTenant(doc),
      insert: async (_ctx, doc) => allowManagerInsert(doc),
      // append-only
      modify: async () => false,
    },
    payments: {
      read: async (_ctx, doc) => managerOrOwnTenant(doc),
      insert: async (_ctx, doc) => allowManagerInsert(doc),
      modify: async () => false,
    },
    tenantScoreSnapshots: {
      read: async (_ctx, doc) => managerOrOwnTenant(doc),
      insert: async (_ctx, doc) => allowManagerInsert(doc),
      modify: async () => false,
    },
    notices: {
      read: async (_ctx, doc) => managerOrOwnTenant(doc),
      insert: async (_ctx, doc) => allowManagerInsert(doc),
      modify: async () => false,
    },
    tenantInvites: {
      // Only the owning manager can read invites through the scoped db; the
      // anonymous accept flow uses the raw db with explicit token checks.
      read: async (_ctx, doc) => ownedByManager(doc),
      insert: async (_ctx, doc) => allowManagerInsert(doc),
      modify: async (_ctx, doc) => ownedByManager(doc),
    },
    auditLogs: {
      read: async (_ctx, doc) => ownedByManager(doc),
      insert: async (_ctx, doc) => allowManagerInsert(doc),
      modify: async () => false,
    },
  };
}

// Local alias to keep the rule closures readable; every scoping id is opaque.
type Id_ = string;
