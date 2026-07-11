import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { managerQuery, managerMutation } from "./lib/functions";
import { errNotFound } from "./lib/errors";
import {
  recomputeAndSnapshot,
  scoreView,
  gatherChargeInputs,
} from "./lib/scoreEngine";
import { computeScore } from "./lib/scoring";
import { latestSnapshot } from "./lib/scoreEngine";
import { todayISO } from "./lib/dates";
import { critical } from "./lib/log";

/** GET /tenants/{id}/score (§7.5) - read-only, staleness-aware, never writes. */
export const get = managerQuery({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) errNotFound("Tenant not found");
    return await scoreView(ctx.db, tenantId);
  },
});

/**
 * POST /tenants/{id}/score/recalculate (§7.4). One of only two writers of a
 * snapshot. Called by the frontend when a Tenant Detail page opens with a stale
 * score.
 */
export const recalculate = managerMutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) errNotFound("Tenant not found");
    const persist = await recomputeAndSnapshot(ctx.db, {
      managerId: tenant.managerId,
      tenantId,
      trigger: "manual_recalculate",
    });
    return {
      score: persist.result.score,
      risk_tier: persist.result.riskTier,
      tier_changed: persist.tierChanged,
      snapshot_id: persist.snapshot._id,
      cycles_used: persist.result.cyclesUsed,
    };
  },
});

/** GET /tenants/{id}/score/history (Addendum A2) - paginated, newest first. */
export const history = managerQuery({
  args: {
    tenantId: v.id("tenants"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { tenantId, paginationOpts }) => {
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) errNotFound("Tenant not found");
    return await ctx.db
      .query("tenantScoreSnapshots")
      .withIndex("by_tenant_calculatedAt", (q) => q.eq("tenantId", tenantId))
      .order("desc")
      .paginate(paginationOpts);
  },
});

/**
 * GET /tenants/{id}/score/breakdown (Addendum A3) - per-cycle inputs behind the
 * current score, derived from the same charges the scoring pass uses.
 */
export const breakdown = managerQuery({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) errNotFound("Tenant not found");
    const inputs = await gatherChargeInputs(ctx.db, tenantId);
    const result = await critical("scores.breakdown", { tenantId }, async () =>
      computeScore(inputs, todayISO()),
    );
    const snapshot = await latestSnapshot(ctx.db, tenantId);
    return {
      snapshot_id: snapshot?._id ?? null,
      cycles: result.breakdown,
      score: result.score,
    };
  },
});
