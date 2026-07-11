import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { enforcePropertyLimit, enforceTenantLimit } from "./limits";

/**
 * Subscription-enforcement tests (PRD §6.4 / §13). Backed by convex-test's
 * in-memory database via `t.run`, exercising the real count-then-check logic.
 */

const modules = import.meta.glob("../**/!(*.test).ts");

async function makeManager(
  ctx: any,
  tier: "free" | "standard" | "premium",
) {
  const userId = await ctx.db.insert("users", { email: `${tier}@t.io` });
  const managerId = await ctx.db.insert("propertyManagers", {
    userId,
    email: `${tier}@t.io`,
    fullName: "T",
    subscriptionTier: tier,
    createdAt: Date.now(),
  });
  return await ctx.db.get(managerId);
}

describe("enforcePropertyLimit", () => {
  it("blocks creating a 2nd property on the free tier (max 1)", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx: any) => {
      const manager = await makeManager(ctx, "free");
      await ctx.db.insert("properties", {
        managerId: manager._id,
        name: "P1",
        address: "A",
        createdAt: Date.now(),
      });
      await expect(enforcePropertyLimit(ctx.db, manager)).rejects.toThrow();
    });
  });

  it("allows unlimited properties on premium", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx: any) => {
      const manager = await makeManager(ctx, "premium");
      for (let i = 0; i < 10; i++) {
        await ctx.db.insert("properties", {
          managerId: manager._id,
          name: `P${i}`,
          address: "A",
          createdAt: Date.now(),
        });
      }
      await expect(enforcePropertyLimit(ctx.db, manager)).resolves.toBeUndefined();
    });
  });
});

describe("enforceTenantLimit (per property)", () => {
  it("blocks the 6th active tenant on a free-tier property (max 5)", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx: any) => {
      const manager = await makeManager(ctx, "free");
      const propertyId = await ctx.db.insert("properties", {
        managerId: manager._id,
        name: "P",
        address: "A",
        createdAt: Date.now(),
      });
      for (let i = 0; i < 5; i++) {
        const unitId = await ctx.db.insert("units", {
          propertyId,
          managerId: manager._id,
          label: `U${i}`,
          monthlyRent: 100,
          createdAt: Date.now(),
        });
        const tenantId = await ctx.db.insert("tenants", {
          managerId: manager._id,
          fullName: `T${i}`,
          email: `t${i}@x.io`,
          phoneNumber: "1",
          inviteStatus: "invited",
          createdAt: Date.now(),
        });
        await ctx.db.insert("tenantUnitAssignments", {
          tenantId,
          unitId,
          managerId: manager._id,
          propertyId,
          rentDueAmount: 100,
          dueDayOfMonth: 1,
          leaseStartDate: "2026-01-01",
          active: true,
          createdAt: Date.now(),
        });
      }
      await expect(enforceTenantLimit(ctx.db, manager, propertyId)).rejects.toThrow();
    });
  });

  it("frees capacity when an assignment is closed (Fix #7)", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx: any) => {
      const manager = await makeManager(ctx, "free");
      const propertyId = await ctx.db.insert("properties", {
        managerId: manager._id,
        name: "P",
        address: "A",
        createdAt: Date.now(),
      });
      const unitId = await ctx.db.insert("units", {
        propertyId,
        managerId: manager._id,
        label: "U",
        monthlyRent: 100,
        createdAt: Date.now(),
      });
      const tenantId = await ctx.db.insert("tenants", {
        managerId: manager._id,
        fullName: "T",
        email: "t@x.io",
        phoneNumber: "1",
        inviteStatus: "invited",
        createdAt: Date.now(),
      });
      const assignmentId = await ctx.db.insert("tenantUnitAssignments", {
        tenantId,
        unitId,
        managerId: manager._id,
        propertyId,
        rentDueAmount: 100,
        dueDayOfMonth: 1,
        leaseStartDate: "2026-01-01",
        active: true,
        createdAt: Date.now(),
      });
      // Fill remaining 4 slots.
      for (let i = 0; i < 4; i++) {
        const u = await ctx.db.insert("units", {
          propertyId, managerId: manager._id, label: `U${i}`, monthlyRent: 100, createdAt: Date.now(),
        });
        const te = await ctx.db.insert("tenants", {
          managerId: manager._id, fullName: `T${i}`, email: `t${i}@x.io`, phoneNumber: "1", inviteStatus: "invited", createdAt: Date.now(),
        });
        await ctx.db.insert("tenantUnitAssignments", {
          tenantId: te, unitId: u, managerId: manager._id, propertyId, rentDueAmount: 100, dueDayOfMonth: 1, leaseStartDate: "2026-01-01", active: true, createdAt: Date.now(),
        });
      }
      await expect(enforceTenantLimit(ctx.db, manager, propertyId)).rejects.toThrow();
      // Close one assignment -> capacity freed.
      await ctx.db.patch(assignmentId, { active: false, leaseEndDate: "2026-02-01" });
      await expect(enforceTenantLimit(ctx.db, manager, propertyId)).resolves.toBeUndefined();
    });
  });
});
