import { v } from "convex/values";
import { managerMutation } from "./lib/functions";
import { errNotFound, errConflict, errInvalidInput } from "./lib/errors";
import { getOrCreateCharge, findCharge } from "./lib/charges";
import { computeCharge } from "./lib/scoring";
import { recomputeAndSnapshot } from "./lib/scoreEngine";
import { writeAudit } from "./lib/audit";
import { todayISO } from "./lib/dates";
import { logInfo } from "./lib/log";
import type { Doc } from "./_generated/dataModel";

/**
 * POST /payments (§7.3). Records an installment (possibly partial, Fix #1)
 * against a charge, auto-creating the charge for the cycle if `chargeId` is
 * omitted. Synchronously persists a fresh score snapshot in the SAME
 * transaction (§6.2 Fix #2) and reports whether the risk tier worsened.
 */
export const record = managerMutation({
  args: {
    chargeId: v.optional(v.id("charges")),
    assignmentId: v.optional(v.id("tenantUnitAssignments")),
    billingCycle: v.optional(v.string()),
    amountPaid: v.number(),
    datePaid: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.amountPaid <= 0) errInvalidInput("amount_paid must be positive");

    let charge: Doc<"charges"> | null;
    if (args.chargeId) {
      charge = await ctx.db.get(args.chargeId);
      if (!charge) errNotFound("Charge not found");
    } else {
      if (!args.assignmentId || !args.billingCycle) {
        errInvalidInput(
          "Provide either charge_id or (assignment_id and billing_cycle)",
        );
      }
      const assignment = await ctx.db.get(args.assignmentId!);
      if (!assignment) errNotFound("Assignment not found");
      charge = await getOrCreateCharge(ctx.db, assignment, args.billingCycle!);
    }

    // Reject over-payment / paying an already-settled charge (design v2 error state).
    const existingPayments = await ctx.db
      .query("payments")
      .withIndex("by_charge", (q) => q.eq("chargeId", charge!._id))
      .collect();
    const collected = existingPayments.reduce((s, p) => s + p.amountPaid, 0);
    const remaining = charge.amountDue - collected;
    if (remaining <= 0) errConflict("Charge is already fully paid");
    if (args.amountPaid > remaining) {
      errConflict(
        `Payment exceeds remaining balance (${remaining}) on this charge`,
        { remaining },
      );
    }

    const paymentId = await ctx.db.insert("payments", {
      chargeId: charge._id,
      tenantId: charge.tenantId,
      managerId: charge.managerId,
      amountPaid: args.amountPaid,
      datePaid: args.datePaid,
      createdAt: Date.now(),
    });

    const persist = await recomputeAndSnapshot(ctx.db, {
      managerId: charge.managerId,
      tenantId: charge.tenantId,
      trigger: "payment_recorded",
    });

    await writeAudit(ctx.db, {
      managerId: charge.managerId,
      tenantId: charge.tenantId,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "payment",
      entityId: paymentId,
      action: "payment_recorded",
      summary: `Recorded ${args.amountPaid} payment against ${charge.billingCycle} charge`,
    });
    logInfo({
      event: "payment_recorded",
      fn: "payments.record",
      managerId: charge.managerId,
      tenantId: charge.tenantId,
      amountPaid: args.amountPaid,
    });

    // Recompute charge status for the response.
    const allPayments = [
      ...existingPayments,
      { amountPaid: args.amountPaid, datePaid: args.datePaid },
    ];
    const computed = computeCharge(
      {
        chargeId: charge._id,
        billingCycle: charge.billingCycle,
        dueDate: charge.dueDate,
        amountDue: charge.amountDue,
        payments: allPayments.map((p) => ({
          amountPaid: p.amountPaid,
          datePaid: p.datePaid,
        })),
      },
      todayISO(),
    );

    return {
      payment: await ctx.db.get(paymentId),
      charge: {
        id: charge._id,
        amountDue: charge.amountDue,
        amountCollected: computed.amountCollected,
        status: computed.status,
      },
      recalculated_score: {
        score: persist.result.score,
        risk_tier: persist.result.riskTier,
        tier_changed: persist.tierChanged,
        snapshot_id: persist.snapshot._id,
      },
    };
  },
});
