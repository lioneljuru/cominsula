import { paginationOptsValidator } from "convex/server";
import { tenantQuery } from "./lib/functions";
import { scoreView, gatherChargeInputs } from "./lib/scoreEngine";
import { computeCharge } from "./lib/scoring";
import { todayISO } from "./lib/dates";

/** GET /me/score (§7.11) - the tenant's own score, staleness-aware, read-only. */
export const score = tenantQuery({
  args: {},
  handler: async (ctx) => await scoreView(ctx.db, ctx.tenant._id),
});

/** GET /me/score/history (Addendum A2, tenant-facing) - paginated. */
export const scoreHistory = tenantQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    return await ctx.db
      .query("tenantScoreSnapshots")
      .withIndex("by_tenant_calculatedAt", (q) =>
        q.eq("tenantId", ctx.tenant._id),
      )
      .order("desc")
      .paginate(paginationOpts);
  },
});

/** GET /me/payments (§7.11) - own installments, each with charge context. */
export const payments = tenantQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db
      .query("payments")
      .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenant._id))
      .order("desc")
      .paginate(paginationOpts);

    const page = [];
    for (const payment of result.page) {
      const charge = await ctx.db.get(payment.chargeId);
      page.push({
        ...payment,
        charge: charge
          ? {
              billingCycle: charge.billingCycle,
              dueDate: charge.dueDate,
              amountDue: charge.amountDue,
            }
          : null,
      });
    }
    return { ...result, page };
  },
});

/** GET /me/notices (§7.11) - own notices, read-only. */
export const notices = tenantQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    return await ctx.db
      .query("notices")
      .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenant._id))
      .order("desc")
      .paginate(paginationOpts);
  },
});

/** Tenant dashboard payload (design v2 "Tenant Dashboard" widgets). */
export const dashboard = tenantQuery({
  args: {},
  handler: async (ctx) => {
    const today = todayISO();
    const view = await scoreView(ctx.db, ctx.tenant._id);

    const assignment = await ctx.db
      .query("tenantUnitAssignments")
      .withIndex("by_tenant_active", (q) =>
        q.eq("tenantId", ctx.tenant._id).eq("active", true),
      )
      .unique();
    const unit = assignment ? await ctx.db.get(assignment.unitId) : null;

    // Next due date: earliest not-fully-paid charge.
    const inputs = await gatherChargeInputs(ctx.db, ctx.tenant._id);
    const outstanding = inputs
      .map((c) => computeCharge(c, today))
      .filter((c) => c.status !== "paid")
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
    const nextDueDate = outstanding[0]?.dueDate ?? null;

    const latestNotice = await ctx.db
      .query("notices")
      .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenant._id))
      .order("desc")
      .first();

    const recentPayments = await ctx.db
      .query("payments")
      .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenant._id))
      .order("desc")
      .take(5);

    return {
      score: view,
      currentRent: assignment?.rentDueAmount ?? null,
      unitLabel: unit?.label ?? null,
      nextDueDate,
      latestNotice,
      recentPayments,
    };
  },
});
