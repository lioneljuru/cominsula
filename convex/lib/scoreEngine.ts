import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  RISK_TIER_SEVERITY,
  SCORING,
  type RiskTier,
  type ScoreTrend,
  type ScoreTrigger,
} from "@cominsula/shared";
import { computeScore, type ChargeInput, type ScoreResult } from "./scoring";
import { todayISO } from "./dates";
import { critical } from "./log";

/**
 * Gather a tenant's charges + installments into the pure scoring engine's input
 * shape. Read-only; used by both persisted recalculation and ephemeral display.
 */
export async function gatherChargeInputs(
  db: DatabaseReader,
  tenantId: Id<"tenants">,
): Promise<ChargeInput[]> {
  const charges = await db
    .query("charges")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect();

  const inputs: ChargeInput[] = [];
  for (const charge of charges) {
    const payments = await db
      .query("payments")
      .withIndex("by_charge", (q) => q.eq("chargeId", charge._id))
      .collect();
    inputs.push({
      chargeId: charge._id,
      billingCycle: charge.billingCycle,
      dueDate: charge.dueDate,
      amountDue: charge.amountDue,
      payments: payments.map((p) => ({
        amountPaid: p.amountPaid,
        datePaid: p.datePaid,
      })),
    });
  }
  return inputs;
}

/** Latest persisted snapshot for a tenant (the "current" score), or null. */
export async function latestSnapshot(
  db: DatabaseReader,
  tenantId: Id<"tenants">,
): Promise<Doc<"tenantScoreSnapshots"> | null> {
  return await db
    .query("tenantScoreSnapshots")
    .withIndex("by_tenant_calculatedAt", (q) => q.eq("tenantId", tenantId))
    .order("desc")
    .first();
}

/** Compute a score without persisting (ephemeral stale display, Fix #2). */
export async function computeEphemeral(
  db: DatabaseReader,
  tenantId: Id<"tenants">,
  now: number = Date.now(),
): Promise<ScoreResult> {
  const inputs = await gatherChargeInputs(db, tenantId);
  return await critical("computeEphemeral", { tenantId }, async () =>
    computeScore(inputs, todayISO(now)),
  );
}

export interface ScoreView {
  score: number | null;
  riskTier: RiskTier;
  previousScore: number | null;
  trend: ScoreTrend;
  cyclesUsed: number;
  asOf: number | null;
  isStale: boolean;
}

function trendOf(current: number | null, previous: number | null): ScoreTrend {
  if (current === null || previous === null) return "flat";
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}

/**
 * Read-only score view (§7.5). Returns the latest persisted snapshot, but if it
 * is stale (>24h old, or a charge silently crossed the miss threshold since),
 * returns an ephemeral, NON-persisted recompute with `isStale: true`. Never
 * writes - safe for GETs and cacheable.
 */
export async function scoreView(
  db: DatabaseReader,
  tenantId: Id<"tenants">,
  now: number = Date.now(),
): Promise<ScoreView> {
  const snapshots = await db
    .query("tenantScoreSnapshots")
    .withIndex("by_tenant_calculatedAt", (q) => q.eq("tenantId", tenantId))
    .order("desc")
    .take(2);
  const latest = snapshots[0] ?? null;
  const previous = snapshots[1] ?? null;

  if (!latest) {
    // No persisted history; compute an ephemeral value for display.
    const ephemeral = await computeEphemeral(db, tenantId, now);
    return {
      score: ephemeral.score,
      riskTier: ephemeral.riskTier,
      previousScore: null,
      trend: "flat",
      cyclesUsed: ephemeral.cyclesUsed,
      asOf: null,
      isStale: ephemeral.cyclesUsed > 0,
    };
  }

  const ephemeral = await computeEphemeral(db, tenantId, now);
  const ageStale = now - latest.calculatedAt > SCORING.STALE_AFTER_MS;
  const valueStale =
    ephemeral.score !== latest.score || ephemeral.riskTier !== latest.riskTier;
  const isStale = ageStale || valueStale;

  const currentScore = isStale ? ephemeral.score : latest.score;
  const currentTier = isStale ? ephemeral.riskTier : latest.riskTier;

  return {
    score: currentScore,
    riskTier: currentTier,
    previousScore: previous?.score ?? null,
    trend: trendOf(currentScore, previous?.score ?? null),
    cyclesUsed: isStale ? ephemeral.cyclesUsed : latest.cyclesUsed,
    asOf: latest.calculatedAt,
    isStale,
  };
}

export interface PersistResult {
  snapshot: Doc<"tenantScoreSnapshots">;
  result: ScoreResult;
  /** True if the new risk tier is strictly worse than the previous one. */
  tierChanged: boolean;
  previousScore: number | null;
}

/**
 * Recompute and persist a new append-only snapshot (§6.2 Fix #2). Runs inside a
 * mutation transaction; the score computation is wrapped in `critical()` so a
 * scoring bug surfaces loudly instead of writing a silently-wrong score.
 */
export async function recomputeAndSnapshot(
  db: DatabaseWriter,
  args: {
    managerId: Id<"propertyManagers">;
    tenantId: Id<"tenants">;
    trigger: ScoreTrigger;
    now?: number;
  },
): Promise<PersistResult> {
  const now = args.now ?? Date.now();
  const inputs = await gatherChargeInputs(db, args.tenantId);
  const result = await critical(
    "recomputeAndSnapshot",
    { managerId: args.managerId, tenantId: args.tenantId },
    async () => computeScore(inputs, todayISO(now)),
  );

  const previous = await latestSnapshot(db, args.tenantId);
  const previousSeverity = previous ? RISK_TIER_SEVERITY[previous.riskTier] : 0;
  const newSeverity = RISK_TIER_SEVERITY[result.riskTier];
  const tierChanged = newSeverity > previousSeverity;

  const snapshotId = await db.insert("tenantScoreSnapshots", {
    tenantId: args.tenantId,
    managerId: args.managerId,
    score: result.score,
    riskTier: result.riskTier,
    cyclesUsed: result.cyclesUsed,
    calculatedAt: now,
    trigger: args.trigger,
  });

  const snapshot = await db.get(snapshotId);
  if (!snapshot) {
    throw new Error("Snapshot insert did not return a document");
  }

  return {
    snapshot,
    result,
    tierChanged,
    previousScore: previous?.score ?? null,
  };
}
