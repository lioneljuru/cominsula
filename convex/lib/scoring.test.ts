import { describe, it, expect } from "vitest";
import { computeCharge, computeScore, type ChargeInput } from "./scoring";

/** Helper to build a charge input with a fixed rent. */
function charge(
  cycle: string,
  dueDate: string,
  amountDue: number,
  payments: { amountPaid: number; datePaid: string }[],
): ChargeInput {
  return { chargeId: cycle, billingCycle: cycle, dueDate, amountDue, payments };
}

describe("computeCharge", () => {
  it("is on_time when fully paid on or before the due date", () => {
    const c = computeCharge(
      charge("2026-01-01", "2026-01-05", 1000, [
        { amountPaid: 1000, datePaid: "2026-01-04" },
      ]),
      "2026-03-01",
    );
    expect(c.status).toBe("paid");
    expect(c.daysLate).toBe(-1);
    expect(c.outcome).toBe("on_time");
  });

  it("buckets lateness into the correct band (16-30 days late)", () => {
    const c = computeCharge(
      charge("2026-01-01", "2026-01-05", 1000, [
        { amountPaid: 1000, datePaid: "2026-01-25" }, // 20 days late
      ]),
      "2026-03-01",
    );
    expect(c.outcome).toBe("late_16_30");
    expect(c.daysLate).toBe(20);
  });

  it("treats a multi-installment charge completed on time as on_time (Fix #1)", () => {
    const c = computeCharge(
      charge("2026-01-01", "2026-01-10", 1000, [
        { amountPaid: 400, datePaid: "2026-01-03" },
        { amountPaid: 600, datePaid: "2026-01-09" },
      ]),
      "2026-03-01",
    );
    expect(c.status).toBe("paid");
    // completion = the installment that crossed amountDue = the 2nd, on the 9th.
    expect(c.completionDatePaid).toBe("2026-01-09");
    expect(c.outcome).toBe("on_time");
  });

  it("scores a charge paid only after the 30-day window as missed (§6.1)", () => {
    const c = computeCharge(
      charge("2026-01-01", "2026-01-05", 1000, [
        { amountPaid: 1000, datePaid: "2026-02-20" }, // >30 days late
      ]),
      "2026-03-01",
    );
    expect(c.status).toBe("paid");
    expect(c.outcome).toBe("missed");
  });

  it("is missed when unpaid past the 30-day threshold", () => {
    const c = computeCharge(
      charge("2026-01-01", "2026-01-05", 1000, []),
      "2026-03-01",
    );
    expect(c.status).toBe("unpaid");
    expect(c.outcome).toBe("missed");
  });

  it("is unscored (null outcome) while still within the grace window", () => {
    const c = computeCharge(
      charge("2026-01-01", "2026-01-05", 1000, [
        { amountPaid: 200, datePaid: "2026-01-04" },
      ]),
      "2026-01-10", // only 5 days past due, still collecting
    );
    expect(c.status).toBe("partial");
    expect(c.outcome).toBeNull();
  });
});

describe("computeScore", () => {
  const today = "2026-06-01";

  it("returns null / unrated with no resolved cycles", () => {
    const r = computeScore([], today);
    expect(r.score).toBeNull();
    expect(r.riskTier).toBe("unrated");
    expect(r.cyclesUsed).toBe(0);
  });

  it("scores a single perfect cycle as 100 / low", () => {
    const r = computeScore(
      [charge("2026-01-01", "2026-01-05", 1000, [{ amountPaid: 1000, datePaid: "2026-01-05" }])],
      today,
    );
    expect(r.score).toBe(100);
    expect(r.riskTier).toBe("low");
    expect(r.cyclesUsed).toBe(1);
  });

  it("applies recency weighting (oldest missed, newest on_time)", () => {
    // oldest weight 1 (missed=0), newest weight 2 (on_time=100)
    // (0*1 + 100*2) / (1+2) = 66.67 -> 67 -> medium
    const r = computeScore(
      [
        charge("2026-01-01", "2026-01-05", 1000, []), // missed
        charge("2026-02-01", "2026-02-05", 1000, [{ amountPaid: 1000, datePaid: "2026-02-05" }]), // on_time
      ],
      today,
    );
    expect(r.score).toBe(67);
    expect(r.riskTier).toBe("medium");
    expect(r.cyclesUsed).toBe(2);
    expect(r.breakdown[0]?.weight).toBe(1);
    expect(r.breakdown[1]?.weight).toBe(2);
  });

  it("caps the window at the 12 most recent resolved cycles", () => {
    const charges: ChargeInput[] = [];
    for (let m = 1; m <= 15; m++) {
      const mm = m.toString().padStart(2, "0");
      // First 3 (oldest) missed, rest on_time. Only last 12 count -> all on_time.
      const paid = m > 3;
      charges.push(
        charge(
          `2025-${mm}-01`,
          `2025-${mm}-05`,
          1000,
          paid ? [{ amountPaid: 1000, datePaid: `2025-${mm}-05` }] : [],
        ),
      );
    }
    const r = computeScore(charges, "2026-06-01");
    expect(r.cyclesUsed).toBe(12);
    expect(r.score).toBe(100);
    expect(r.riskTier).toBe("low");
  });

  it("produces a high-risk score for a chronically missing tenant", () => {
    const charges: ChargeInput[] = [];
    for (let m = 1; m <= 6; m++) {
      const mm = m.toString().padStart(2, "0");
      charges.push(charge(`2026-${mm}-01`, `2026-${mm}-05`, 1000, []));
    }
    const r = computeScore(charges, "2026-08-01");
    expect(r.score).toBe(0);
    expect(r.riskTier).toBe("high");
  });
});
