import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { managerQuery, managerMutation } from "./lib/functions";
import { errNotFound } from "./lib/errors";
import { createCharge } from "./lib/charges";
import { computeCharge } from "./lib/scoring";
import { writeAudit } from "./lib/audit";
import { todayISO } from "./lib/dates";

/**
 * POST /charges (Addendum A5). Pre-create a cycle's obligation before any
 * payment exists, so "Overdue" is computable even with zero payment attempts.
 */
export const create = managerMutation({
  args: {
    assignmentId: v.id("tenantUnitAssignments"),
    billingCycle: v.string(),
  },
  handler: async (ctx, { assignmentId, billingCycle }) => {
    const assignment = await ctx.db.get(assignmentId);
    if (!assignment) errNotFound("Assignment not found");
    const charge = await createCharge(ctx.db, assignment, billingCycle);
    await writeAudit(ctx.db, {
      managerId: ctx.manager._id,
      tenantId: assignment.tenantId,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "charge",
      entityId: charge._id,
      action: "created",
      summary: `Created charge for ${charge.billingCycle}`,
    });
    return { charge, status: "unpaid" as const };
  },
});

/**
 * Paginated charge history for a tenant, each enriched with its derived status,
 * lateness, and installments (§6.1). Used by the Tenant Detail "Charges" tab.
 */
export const listByTenant = managerQuery({
  args: {
    tenantId: v.id("tenants"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { tenantId, paginationOpts }) => {
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) errNotFound("Tenant not found");
    const today = todayISO();

    const result = await ctx.db
      .query("charges")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .order("desc")
      .paginate(paginationOpts);

    const page = [];
    for (const charge of result.page) {
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
      page.push({
        ...charge,
        amountCollected: computed.amountCollected,
        status: computed.status,
        outcome: computed.outcome,
        completionDatePaid: computed.completionDatePaid,
        daysLate: computed.daysLate,
        installments: payments
          .slice()
          .sort((a, b) => (a.datePaid < b.datePaid ? -1 : 1)),
      });
    }

    return { ...result, page };
  },
});
