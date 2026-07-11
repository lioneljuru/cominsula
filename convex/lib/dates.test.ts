import { describe, it, expect } from "vitest";
import {
  dueDateFor,
  daysBetween,
  addDays,
  billingCycleOf,
  todayISO,
  fromUTC,
} from "./dates";

describe("dueDateFor", () => {
  it("uses the exact due day when valid", () => {
    expect(dueDateFor("2026-03-01", 15)).toBe("2026-03-15");
  });

  it("clamps the due day to the last day of a short month", () => {
    expect(dueDateFor("2026-02-01", 31)).toBe("2026-02-28");
    expect(dueDateFor("2024-02-01", 31)).toBe("2024-02-29"); // leap year
  });

  it("rejects out-of-range due days", () => {
    expect(() => dueDateFor("2026-01-01", 0)).toThrow();
    expect(() => dueDateFor("2026-01-01", 32)).toThrow();
  });
});

describe("daysBetween / addDays", () => {
  it("computes signed whole-day differences", () => {
    expect(daysBetween("2026-01-01", "2026-01-06")).toBe(5);
    expect(daysBetween("2026-01-06", "2026-01-01")).toBe(-5);
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-01-30", 5)).toBe("2026-02-04");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("billingCycleOf", () => {
  it("normalizes any date to the first of its month", () => {
    expect(billingCycleOf("2026-07-19")).toBe("2026-07-01");
  });
});

describe("todayISO", () => {
  it("formats an epoch-ms override to a UTC ISO date", () => {
    expect(todayISO(Date.UTC(2026, 6, 4))).toBe("2026-07-04");
    expect(fromUTC(Date.UTC(2026, 0, 1))).toBe("2026-01-01");
  });
});
