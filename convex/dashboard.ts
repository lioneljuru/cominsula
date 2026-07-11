import { managerQuery } from "./lib/functions";
import { latestSnapshot } from "./lib/scoreEngine";
import { computeCharge } from "./lib/scoring";
import { TIER_LIMITS } from "@cominsula/shared";
import { todayISO, billingCycleOf } from "./lib/dates";

/**
 * GET /dashboard (§8.1). Strictly read-only (Fix #2): Convex `query` functions
 * cannot write, so this is guaranteed side-effect-free and cacheable. Per-tenant
 * scores come from the latest PERSISTED snapshot (one indexed read each), which
 * is what keeps the page within its <1.5s budget under the reactive cache.
 */
export const get = managerQuery({
  args: {},
  handler: async (ctx) => {
    const managerId = ctx.manager._id;
    const today = todayISO();
    const thisMonth = billingCycleOf(today);

    const [properties, units, assignments, tenants] = await Promise.all([
      ctx.db
        .query("properties")
        .withIndex("by_manager", (q) => q.eq("managerId", managerId))
        .collect(),
      ctx.db
        .query("units")
        .withIndex("by_manager", (q) => q.eq("managerId", managerId))
        .collect(),
      ctx.db
        .query("tenantUnitAssignments")
        .withIndex("by_manager", (q) => q.eq("managerId", managerId))
        .collect(),
      ctx.db
        .query("tenants")
        .withIndex("by_manager", (q) => q.eq("managerId", managerId))
        .collect(),
    ]);

    const activeAssignments = assignments.filter((a) => a.active);
    const activeTenants = tenants.filter((t) => t.inviteStatus !== "removed");

    // Per-tenant current score from the latest persisted snapshot.
    const attention = [];
    let highRisk = 0;
    for (const tenant of activeTenants) {
      const snapshot = await latestSnapshot(ctx.db, tenant._id);
      const score = snapshot?.score ?? null;
      const riskTier = snapshot?.riskTier ?? "unrated";
      if (riskTier === "high") highRisk++;
      attention.push({
        tenantId: tenant._id,
        name: tenant.fullName,
        score,
        riskTier,
        asOf: snapshot?.calculatedAt ?? null,
      });
    }
    // Riskiest first: lowest score, then unrated last.
    attention.sort((a, b) => {
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return a.score - b.score;
    });

    // Overdue this month: current-cycle charges not fully paid past their due date.
    let overdueThisMonth = 0;
    const currentCharges = (
      await ctx.db
        .query("charges")
        .withIndex("by_manager", (q) => q.eq("managerId", managerId))
        .collect()
    ).filter((c) => c.billingCycle === thisMonth);
    for (const charge of currentCharges) {
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_charge", (q) => q.eq("chargeId", charge._id))
        .collect();
      const computed = computeCharge(
        {
          chargeId: charge._id,
          billingCycle: charge.billingCycle,
          dueDate: charge.dueDate,
          amountDue: charge.amountDue,
          payments: payments.map((p) => ({
            amountPaid: p.amountPaid,
            datePaid: p.datePaid,
          })),
        },
        today,
      );
      if (computed.status !== "paid" && today > charge.dueDate) overdueThisMonth++;
    }

    const tierLimits = TIER_LIMITS[ctx.manager.subscriptionTier];

    return {
      summary: {
        totalUnits: units.length,
        occupiedUnits: activeAssignments.length,
        highRiskTenants: highRisk,
        overdueThisMonth,
      },
      attention,
      subscription: {
        tier: ctx.manager.subscriptionTier,
        propertiesUsed: properties.length,
        propertiesMax: tierLimits.properties,
      },
    };
  },
});
