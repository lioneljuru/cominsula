import { describe, it, expect } from "vitest";
import {
  TIER_LIMITS,
  scoreToRiskTier,
  RISK_TIER_SEVERITY,
} from "@cominsula/shared";

describe("subscription tier limits (§6.4)", () => {
  it("encodes the PRD limit table exactly", () => {
    expect(TIER_LIMITS.free).toEqual({ properties: 1, tenantsPerProperty: 5 });
    expect(TIER_LIMITS.standard).toEqual({ properties: 5, tenantsPerProperty: 15 });
    expect(TIER_LIMITS.premium.tenantsPerProperty).toBe(30);
    expect(Number.isFinite(TIER_LIMITS.premium.properties)).toBe(false);
  });
});

describe("scoreToRiskTier (§6.2 bands)", () => {
  it("maps scores to the correct band", () => {
    expect(scoreToRiskTier(100)).toBe("low");
    expect(scoreToRiskTier(80)).toBe("low");
    expect(scoreToRiskTier(79)).toBe("medium");
    expect(scoreToRiskTier(50)).toBe("medium");
    expect(scoreToRiskTier(49)).toBe("high");
    expect(scoreToRiskTier(0)).toBe("high");
    expect(scoreToRiskTier(null)).toBe("unrated");
  });

  it("orders severity so a worsening tier is detectable", () => {
    expect(RISK_TIER_SEVERITY.high).toBeGreaterThan(RISK_TIER_SEVERITY.medium);
    expect(RISK_TIER_SEVERITY.medium).toBeGreaterThan(RISK_TIER_SEVERITY.low);
    expect(RISK_TIER_SEVERITY.low).toBeGreaterThan(RISK_TIER_SEVERITY.unrated);
  });
});
