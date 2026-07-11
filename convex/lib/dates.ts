/**
 * Timezone-free calendar-date helpers. Dates are ISO "YYYY-MM-DD" strings and
 * all arithmetic is done in UTC so lateness math is deterministic regardless of
 * where the server or manager is (PRD §11: no region assumptions).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertISODate(value: string): string {
  if (!ISO_DATE.test(value)) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return value;
}

/** Parse "YYYY-MM-DD" into a UTC midnight epoch-ms value. */
export function toUTC(date: string): number {
  assertISODate(date);
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Format a UTC epoch-ms value back into "YYYY-MM-DD". */
export function fromUTC(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear().toString().padStart(4, "0");
  const m = (dt.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = dt.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today's date (UTC) as "YYYY-MM-DD"; accepts an override for testing. */
export function todayISO(now: number = Date.now()): string {
  return fromUTC(now);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days from `a` to `b` (`b - a`); negative if `b` precedes `a`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / MS_PER_DAY);
}

export function addDays(date: string, days: number): string {
  return fromUTC(toUTC(date) + days * MS_PER_DAY);
}

/** First day of the month containing `date`, i.e. a canonical billing cycle. */
export function billingCycleOf(date: string): string {
  assertISODate(date);
  const [y, m] = date.split("-") as [string, string, string];
  return `${y}-${m}-01`;
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/**
 * Due date for a billing cycle given a `dueDayOfMonth` (1-31). The day is
 * clamped to the last valid day of the cycle's month (e.g. a due-day of 31 in
 * February resolves to the 28th/29th).
 */
export function dueDateFor(billingCycle: string, dueDayOfMonth: number): string {
  assertISODate(billingCycle);
  if (dueDayOfMonth < 1 || dueDayOfMonth > 31) {
    throw new Error(`due_day_of_month out of range: ${dueDayOfMonth}`);
  }
  const [y, m] = billingCycle.split("-").map(Number) as [number, number, number];
  const clamped = Math.min(dueDayOfMonth, daysInMonth(y, m - 1));
  return `${y.toString().padStart(4, "0")}-${m
    .toString()
    .padStart(2, "0")}-${clamped.toString().padStart(2, "0")}`;
}
