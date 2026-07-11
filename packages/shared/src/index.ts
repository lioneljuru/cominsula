/**
 * Shared, framework-agnostic domain types and constants for Cominsula.io.
 *
 * This package must not import Convex or React. It is the single source of
 * truth for enums, subscription limits, and scoring constants used on both the
 * backend (convex/) and the frontend (apps/web/).
 */

export const SUBSCRIPTION_TIERS = ["free", "standard", "premium"] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const RISK_TIERS = ["low", "medium", "high", "unrated"] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

export const INVITE_STATUSES = ["invited", "active", "removed"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const UNIT_STATUSES = ["vacant", "occupied"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const CHARGE_STATUSES = ["unpaid", "partial", "paid"] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export const SCORE_TRIGGERS = [
  "payment_recorded",
  "manual_recalculate",
  "unit_transfer",
] as const;
export type ScoreTrigger = (typeof SCORE_TRIGGERS)[number];

export const ACTOR_TYPES = ["manager", "tenant", "system"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/**
 * Per-tier limits (PRD v3 §6.4). `Infinity` denotes "unlimited"; callers must
 * treat non-finite maxima as never-blocking.
 */
export interface TierLimits {
  /** Max number of properties a manager may own. */
  properties: number;
  /** Max number of active tenant assignments per property. */
  tenantsPerProperty: number;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: { properties: 1, tenantsPerProperty: 5 },
  standard: { properties: 5, tenantsPerProperty: 15 },
  premium: { properties: Number.POSITIVE_INFINITY, tenantsPerProperty: 30 },
};

/**
 * Scoring configuration (PRD v3 §6.2). Deterministic, no AI/ML.
 */
export const SCORING = {
  /** Sliding window of most-recent charges fed into a score. */
  WINDOW: 12,
  /** Minimum completed cycles required, else score is null / unrated. */
  MIN_CYCLES: 1,
  /** A charge unpaid past this many days after its due date is "missed". */
  MISS_THRESHOLD_DAYS: 30,
  /** A persisted snapshot older than this (ms) is considered stale for reads. */
  STALE_AFTER_MS: 24 * 60 * 60 * 1000,
} as const;

/** Per-cycle payment outcome buckets, ordered best -> worst. */
export const CYCLE_OUTCOMES = [
  "on_time",
  "late_1_5",
  "late_6_15",
  "late_16_30",
  "missed",
] as const;
export type CycleOutcome = (typeof CYCLE_OUTCOMES)[number];

/** Points awarded per cycle outcome (PRD v3 §6.2). */
export const OUTCOME_POINTS: Record<CycleOutcome, number> = {
  on_time: 100,
  late_1_5: 80,
  late_6_15: 50,
  late_16_30: 20,
  missed: 0,
};

export interface RiskTierBand {
  tier: Exclude<RiskTier, "unrated">;
  min: number;
  max: number;
}

/** Score-to-risk-tier bands (PRD v3 §6.2). */
export const RISK_TIER_BANDS: readonly RiskTierBand[] = [
  { tier: "low", min: 80, max: 100 },
  { tier: "medium", min: 50, max: 79 },
  { tier: "high", min: 0, max: 49 },
];

export function scoreToRiskTier(score: number | null): RiskTier {
  if (score === null) return "unrated";
  const band = RISK_TIER_BANDS.find((b) => score >= b.min && score <= b.max);
  return band?.tier ?? "unrated";
}

/**
 * Relative severity of a risk tier, used to detect a worsening trend
 * (higher number = worse). "unrated" is treated as neutral / lowest severity.
 */
export const RISK_TIER_SEVERITY: Record<RiskTier, number> = {
  unrated: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export type ScoreTrend = "up" | "down" | "flat";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
