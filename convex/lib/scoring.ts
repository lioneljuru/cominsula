/**
 * Deterministic tenant reliability scoring engine (PRD v3 §6.1 / §6.2).
 *
 * This module is pure (no Convex, no I/O) so it can be unit-tested exhaustively
 * and can never "swallow" a failure into a default value (PRD §11). Callers pass
 * in the tenant's charges + installments and "today"; it returns the score, the
 * risk tier, and a per-cycle breakdown (Addendum A3).
 *
 * Interpretation notes (stated so engineering doesn't guess):
 *  - A cycle is *resolved* once it has a definite outcome: fully paid, or past
 *    the 30-day miss threshold. Unresolved (still-collecting, not-yet-late)
 *    charges do not feed the score and are excluded from the window.
 *  - A charge fully paid only after the 30-day window scores as `missed`; a late
 *    trailing payment satisfies it financially but does not restore trust
 *    (§6.1).
 *  - The window is the most recent `SCORING.WINDOW` (12) resolved cycles.
 */
import {
  OUTCOME_POINTS,
  SCORING,
  scoreToRiskTier,
  type CycleOutcome,
  type RiskTier,
} from "@cominsula/shared";
import { daysBetween, addDays } from "./dates";

export interface PaymentInput {
  amountPaid: number;
  datePaid: string;
}

export interface ChargeInput {
  chargeId: string;
  billingCycle: string;
  dueDate: string;
  amountDue: number;
  payments: PaymentInput[];
}

export interface ChargeComputation {
  chargeId: string;
  billingCycle: string;
  dueDate: string;
  amountDue: number;
  amountCollected: number;
  status: "unpaid" | "partial" | "paid";
  completionDatePaid: string | null;
  daysLate: number | null;
  /** Definite scoring outcome, or null while the cycle is still in-flight. */
  outcome: CycleOutcome | null;
}

export interface BreakdownCycle {
  billingCycle: string;
  outcome: CycleOutcome;
  points: number;
  weight: number;
}

export interface ScoreResult {
  score: number | null;
  riskTier: RiskTier;
  cyclesUsed: number;
  breakdown: BreakdownCycle[];
}

/** Bucket a fully-paid charge's lateness into an outcome. */
function outcomeForDaysLate(daysLate: number): CycleOutcome {
  if (daysLate <= 0) return "on_time";
  if (daysLate <= 5) return "late_1_5";
  if (daysLate <= 15) return "late_6_15";
  if (daysLate <= SCORING.MISS_THRESHOLD_DAYS) return "late_16_30";
  return "missed";
}

/**
 * Compute the financial + lateness state of a single charge relative to
 * `today`. Exposed for both scoring and read models (charge status display).
 */
export function computeCharge(charge: ChargeInput, today: string): ChargeComputation {
  const amountCollected = charge.payments.reduce((sum, p) => sum + p.amountPaid, 0);

  let status: ChargeComputation["status"] = "unpaid";
  if (amountCollected >= charge.amountDue && charge.amountDue > 0) status = "paid";
  else if (amountCollected > 0) status = "partial";

  // Completion date: the installment (chronologically) that first brings the
  // cumulative collected amount up to amountDue. Ties on the same day resolve to
  // that day (§6.1 "use the latest").
  let completionDatePaid: string | null = null;
  if (status === "paid") {
    const sorted = [...charge.payments].sort((a, b) =>
      a.datePaid < b.datePaid ? -1 : a.datePaid > b.datePaid ? 1 : 0,
    );
    let running = 0;
    for (const p of sorted) {
      running += p.amountPaid;
      if (running >= charge.amountDue) {
        completionDatePaid = p.datePaid;
        break;
      }
    }
  }

  const daysLate =
    completionDatePaid !== null ? daysBetween(charge.dueDate, completionDatePaid) : null;

  let outcome: CycleOutcome | null = null;
  if (status === "paid" && daysLate !== null) {
    outcome = outcomeForDaysLate(daysLate);
  } else {
    // Not fully paid: it is a definite "missed" once past the miss threshold,
    // otherwise still in-flight and unscored.
    const missCutoff = addDays(charge.dueDate, SCORING.MISS_THRESHOLD_DAYS);
    if (today > missCutoff) outcome = "missed";
  }

  return {
    chargeId: charge.chargeId,
    billingCycle: charge.billingCycle,
    dueDate: charge.dueDate,
    amountDue: charge.amountDue,
    amountCollected,
    status,
    completionDatePaid,
    daysLate,
    outcome,
  };
}

/**
 * Compute a tenant's score from their charges as of `today`.
 * Recency-weighted linear average: oldest cycle weight 1 ... newest weight N.
 */
export function computeScore(charges: ChargeInput[], today: string): ScoreResult {
  const resolved = charges
    .map((c) => computeCharge(c, today))
    .filter((c): c is ChargeComputation & { outcome: CycleOutcome } => c.outcome !== null)
    .sort((a, b) =>
      a.billingCycle < b.billingCycle ? -1 : a.billingCycle > b.billingCycle ? 1 : 0,
    );

  const window = resolved.slice(-SCORING.WINDOW);

  if (window.length < SCORING.MIN_CYCLES) {
    return { score: null, riskTier: "unrated", cyclesUsed: 0, breakdown: [] };
  }

  const breakdown: BreakdownCycle[] = window.map((c, i) => ({
    billingCycle: c.billingCycle,
    outcome: c.outcome,
    points: OUTCOME_POINTS[c.outcome],
    weight: i + 1,
  }));

  const weightedSum = breakdown.reduce((s, c) => s + c.points * c.weight, 0);
  const weightTotal = breakdown.reduce((s, c) => s + c.weight, 0);
  const score = Math.round(weightedSum / weightTotal);

  return {
    score,
    riskTier: scoreToRiskTier(score),
    cyclesUsed: window.length,
    breakdown,
  };
}
