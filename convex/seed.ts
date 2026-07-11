import { internalMutation } from "./_generated/server";
import type { DatabaseWriter } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { SubscriptionTier } from "@cominsula/shared";
import { dueDateFor, addDays, billingCycleOf, fromUTC } from "./lib/dates";
import { recomputeAndSnapshot } from "./lib/scoreEngine";
import { generateInviteToken, hashInviteToken } from "./lib/crypto";
import { logInfo } from "./lib/log";

/**
 * Seed script (PRD §12). Produces 3 managers across all tiers, properties,
 * units, ~15 tenants, and 6-12 months of varied payment history - including
 * >=2 tenants with multi-installment partial payments and 1 unit transfer, and
 * >=3 high-risk tenants - so every v3.0/v3.1 fix is demonstrably exercised.
 *
 * Run with: `npx convex run seed:run`
 */

type Outcome =
  | "on_time"
  | "late_5"
  | "late_20"
  | "missed"
  | "partial_complete"
  | "partial_missed";

/** N months before the current month, as a "YYYY-MM-01" cycle. */
function monthsAgoCycle(monthsAgo: number, now: number): string {
  const d = new Date(now);
  const cycle = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsAgo, 1);
  return billingCycleOf(fromUTC(cycle));
}

async function makeUser(
  db: DatabaseWriter,
  email: string,
  name: string,
): Promise<Id<"users">> {
  return await db.insert("users", { email, name });
}

async function makeManager(
  db: DatabaseWriter,
  tier: SubscriptionTier,
  fullName: string,
  email: string,
): Promise<Id<"propertyManagers">> {
  const userId = await makeUser(db, email, fullName);
  return await db.insert("propertyManagers", {
    userId,
    email,
    fullName,
    subscriptionTier: tier,
    createdAt: Date.now(),
  });
}

async function makeProperty(
  db: DatabaseWriter,
  managerId: Id<"propertyManagers">,
  name: string,
  address: string,
): Promise<Id<"properties">> {
  return await db.insert("properties", {
    managerId,
    name,
    address,
    createdAt: Date.now(),
  });
}

async function makeUnit(
  db: DatabaseWriter,
  managerId: Id<"propertyManagers">,
  propertyId: Id<"properties">,
  label: string,
  monthlyRent: number,
): Promise<Id<"units">> {
  return await db.insert("units", {
    managerId,
    propertyId,
    label,
    monthlyRent,
    createdAt: Date.now(),
  });
}

async function makeTenant(
  db: DatabaseWriter,
  managerId: Id<"propertyManagers">,
  fullName: string,
  email: string,
  active: boolean,
): Promise<Id<"tenants">> {
  return await db.insert("tenants", {
    managerId,
    fullName,
    email,
    phoneNumber: "+10000000000",
    inviteStatus: active ? "active" : "invited",
    createdAt: Date.now(),
  });
}

async function openAssignment(
  db: DatabaseWriter,
  args: {
    tenantId: Id<"tenants">;
    unitId: Id<"units">;
    managerId: Id<"propertyManagers">;
    propertyId: Id<"properties">;
    rent: number;
    dueDay: number;
    startCycle: string;
  },
): Promise<Id<"tenantUnitAssignments">> {
  return await db.insert("tenantUnitAssignments", {
    tenantId: args.tenantId,
    unitId: args.unitId,
    managerId: args.managerId,
    propertyId: args.propertyId,
    rentDueAmount: args.rent,
    dueDayOfMonth: args.dueDay,
    leaseStartDate: args.startCycle,
    leaseEndDate: undefined,
    active: true,
    createdAt: Date.now(),
  });
}

/** Create a charge for a cycle and record installments matching `outcome`. */
async function addCycle(
  db: DatabaseWriter,
  args: {
    assignmentId: Id<"tenantUnitAssignments">;
    tenantId: Id<"tenants">;
    managerId: Id<"propertyManagers">;
    cycle: string;
    rent: number;
    dueDay: number;
    outcome: Outcome;
  },
): Promise<void> {
  const dueDate = dueDateFor(args.cycle, args.dueDay);
  const chargeId = await db.insert("charges", {
    assignmentId: args.assignmentId,
    tenantId: args.tenantId,
    managerId: args.managerId,
    billingCycle: args.cycle,
    amountDue: args.rent,
    dueDate,
    createdAt: Date.now(),
  });

  const pay = async (amount: number, datePaid: string) => {
    await db.insert("payments", {
      chargeId,
      tenantId: args.tenantId,
      managerId: args.managerId,
      amountPaid: amount,
      datePaid,
      createdAt: Date.now(),
    });
  };

  switch (args.outcome) {
    case "on_time":
      await pay(args.rent, addDays(dueDate, -1));
      break;
    case "late_5":
      await pay(args.rent, addDays(dueDate, 5));
      break;
    case "late_20":
      await pay(args.rent, addDays(dueDate, 20));
      break;
    case "missed":
      // No payments; scored as missed once past the 30-day threshold.
      break;
    case "partial_complete":
      // Two installments that together settle the charge on time-ish.
      await pay(Math.round(args.rent / 2), addDays(dueDate, 2));
      await pay(args.rent - Math.round(args.rent / 2), addDays(dueDate, 12));
      break;
    case "partial_missed":
      // A partial that never completes -> missed for scoring (§6.1).
      await pay(Math.round(args.rent / 3), addDays(dueDate, 3));
      break;
  }
}

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const db = ctx.db;
    const now = Date.now();
    const cycles = Array.from({ length: 8 }, (_, i) => monthsAgoCycle(7 - i, now));

    // --- Manager A: free tier, small, healthy ---
    const mgrA = await makeManager(db, "free", "Ama Owusu", "ama@demo.cominsula.io");
    const propA = await makeProperty(db, mgrA, "Cedar Court", "12 Cedar St");
    const unitA1 = await makeUnit(db, mgrA, propA, "Unit 1", 900);
    const tA1 = await makeTenant(db, mgrA, "John Tenant", "john@demo.cominsula.io", true);
    const asgA1 = await openAssignment(db, {
      tenantId: tA1, unitId: unitA1, managerId: mgrA, propertyId: propA,
      rent: 900, dueDay: 1, startCycle: cycles[0]!,
    });
    for (const cycle of cycles) {
      await addCycle(db, { assignmentId: asgA1, tenantId: tA1, managerId: mgrA, cycle, rent: 900, dueDay: 1, outcome: "on_time" });
    }

    // --- Manager B: standard tier, varied history, transfer + partials ---
    const mgrB = await makeManager(db, "standard", "Bilal Khan", "bilal@demo.cominsula.io");
    const propB = await makeProperty(db, mgrB, "Marina Heights", "88 Marina Rd");
    const unitsB = [];
    for (let i = 1; i <= 6; i++) {
      unitsB.push(await makeUnit(db, mgrB, propB, `Apt ${i}`, 1200 + i * 50));
    }

    // Reliable tenant.
    const tB1 = await makeTenant(db, mgrB, "Grace Mwangi", "grace@demo.cominsula.io", true);
    const asgB1 = await openAssignment(db, {
      tenantId: tB1, unitId: unitsB[0]!, managerId: mgrB, propertyId: propB,
      rent: 1250, dueDay: 5, startCycle: cycles[0]!,
    });
    const b1Pattern: Outcome[] = ["on_time", "on_time", "late_5", "on_time", "on_time", "late_5", "on_time", "on_time"];
    for (let i = 0; i < cycles.length; i++) {
      await addCycle(db, { assignmentId: asgB1, tenantId: tB1, managerId: mgrB, cycle: cycles[i]!, rent: 1250, dueDay: 5, outcome: b1Pattern[i]! });
    }

    // Tenant with multi-installment partial payments (#1).
    const tB2 = await makeTenant(db, mgrB, "Diego Silva", "diego@demo.cominsula.io", true);
    const asgB2 = await openAssignment(db, {
      tenantId: tB2, unitId: unitsB[1]!, managerId: mgrB, propertyId: propB,
      rent: 1300, dueDay: 3, startCycle: cycles[0]!,
    });
    const b2Pattern: Outcome[] = ["on_time", "partial_complete", "on_time", "partial_complete", "late_20", "on_time", "partial_complete", "on_time"];
    for (let i = 0; i < cycles.length; i++) {
      await addCycle(db, { assignmentId: asgB2, tenantId: tB2, managerId: mgrB, cycle: cycles[i]!, rent: 1300, dueDay: 3, outcome: b2Pattern[i]! });
    }

    // High-risk tenant #1.
    const tB3 = await makeTenant(db, mgrB, "Frank Osei", "frank@demo.cominsula.io", true);
    const asgB3 = await openAssignment(db, {
      tenantId: tB3, unitId: unitsB[2]!, managerId: mgrB, propertyId: propB,
      rent: 1350, dueDay: 1, startCycle: cycles[0]!,
    });
    const b3Pattern: Outcome[] = ["late_20", "missed", "late_20", "missed", "partial_missed", "missed", "late_20", "missed"];
    for (let i = 0; i < cycles.length; i++) {
      await addCycle(db, { assignmentId: asgB3, tenantId: tB3, managerId: mgrB, cycle: cycles[i]!, rent: 1350, dueDay: 1, outcome: b3Pattern[i]! });
    }

    // Tenant demonstrating a UNIT TRANSFER (#11): first 4 cycles on Apt 4, then transferred to Apt 5.
    const tB4 = await makeTenant(db, mgrB, "Helena Ruiz", "helena@demo.cominsula.io", true);
    const asgB4a = await openAssignment(db, {
      tenantId: tB4, unitId: unitsB[3]!, managerId: mgrB, propertyId: propB,
      rent: 1400, dueDay: 10, startCycle: cycles[0]!,
    });
    for (let i = 0; i < 4; i++) {
      await addCycle(db, { assignmentId: asgB4a, tenantId: tB4, managerId: mgrB, cycle: cycles[i]!, rent: 1400, dueDay: 10, outcome: "on_time" });
    }
    // Close the first assignment, open a new one on a different unit.
    await db.patch(asgB4a, { active: false, leaseEndDate: cycles[4]! });
    const asgB4b = await openAssignment(db, {
      tenantId: tB4, unitId: unitsB[4]!, managerId: mgrB, propertyId: propB,
      rent: 1500, dueDay: 10, startCycle: cycles[4]!,
    });
    const b4Late: Outcome[] = ["on_time", "late_5", "on_time", "late_20"];
    for (let i = 4; i < cycles.length; i++) {
      await addCycle(db, { assignmentId: asgB4b, tenantId: tB4, managerId: mgrB, cycle: cycles[i]!, rent: 1500, dueDay: 10, outcome: b4Late[i - 4]! });
    }

    // --- Manager C: premium tier, extra high-risk tenants + a live-demo tenant ---
    const mgrC = await makeManager(db, "premium", "Chen Wei", "chen@demo.cominsula.io");
    const propC = await makeProperty(db, mgrC, "Summit Towers", "1 Summit Ave");
    const unitsC = [];
    for (let i = 1; i <= 8; i++) {
      unitsC.push(await makeUnit(db, mgrC, propC, `Suite ${i}`, 2000 + i * 100));
    }

    // High-risk tenant #2.
    const tC1 = await makeTenant(db, mgrC, "Ivan Petrov", "ivan@demo.cominsula.io", true);
    const asgC1 = await openAssignment(db, {
      tenantId: tC1, unitId: unitsC[0]!, managerId: mgrC, propertyId: propC,
      rent: 2100, dueDay: 1, startCycle: cycles[0]!,
    });
    const c1Pattern: Outcome[] = ["missed", "missed", "late_20", "missed", "late_20", "partial_missed", "missed", "late_20"];
    for (let i = 0; i < cycles.length; i++) {
      await addCycle(db, { assignmentId: asgC1, tenantId: tC1, managerId: mgrC, cycle: cycles[i]!, rent: 2100, dueDay: 1, outcome: c1Pattern[i]! });
    }

    // High-risk tenant #3 (with a second multi-installment partial history).
    const tC2 = await makeTenant(db, mgrC, "Julia Nowak", "julia@demo.cominsula.io", true);
    const asgC2 = await openAssignment(db, {
      tenantId: tC2, unitId: unitsC[1]!, managerId: mgrC, propertyId: propC,
      rent: 2200, dueDay: 15, startCycle: cycles[0]!,
    });
    const c2Pattern: Outcome[] = ["late_20", "partial_complete", "missed", "late_20", "missed", "partial_complete", "missed", "late_20"];
    for (let i = 0; i < cycles.length; i++) {
      await addCycle(db, { assignmentId: asgC2, tenantId: tC2, managerId: mgrC, cycle: cycles[i]!, rent: 2200, dueDay: 15, outcome: c2Pattern[i]! });
    }

    // Live-demo tenant: healthy history, poised to drop a tier when a late/missed
    // payment is entered during the demo. Also linked to a known invite token so
    // the tenant portal can be exercised end-to-end.
    const tC3 = await makeTenant(db, mgrC, "Kofi Mensah", "kofi@demo.cominsula.io", false);
    const asgC3 = await openAssignment(db, {
      tenantId: tC3, unitId: unitsC[2]!, managerId: mgrC, propertyId: propC,
      rent: 2300, dueDay: 1, startCycle: cycles[0]!,
    });
    // 6 clean cycles, then leave the two most recent cycles OPEN (no charge yet)
    // so the demoer records a late payment live to trigger a visible tier drop.
    const c3Pattern: Outcome[] = ["on_time", "on_time", "on_time", "on_time", "late_5", "on_time"];
    for (let i = 0; i < c3Pattern.length; i++) {
      await addCycle(db, { assignmentId: asgC3, tenantId: tC3, managerId: mgrC, cycle: cycles[i]!, rent: 2300, dueDay: 1, outcome: c3Pattern[i]! });
    }
    const demoToken = generateInviteToken();
    await db.insert("tenantInvites", {
      tenantId: tC3,
      managerId: mgrC,
      tokenHash: hashInviteToken(demoToken),
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      createdAt: now,
    });

    // Persist an initial score snapshot for every tenant.
    const allTenants: Array<{ id: Id<"tenants">; managerId: Id<"propertyManagers"> }> = [
      { id: tA1, managerId: mgrA },
      { id: tB1, managerId: mgrB },
      { id: tB2, managerId: mgrB },
      { id: tB3, managerId: mgrB },
      { id: tB4, managerId: mgrB },
      { id: tC1, managerId: mgrC },
      { id: tC2, managerId: mgrC },
      { id: tC3, managerId: mgrC },
    ];
    for (const t of allTenants) {
      await recomputeAndSnapshot(db, {
        managerId: t.managerId,
        tenantId: t.id,
        trigger: "manual_recalculate",
        now,
      });
    }

    logInfo({
      event: "seed_complete",
      fn: "seed.run",
      managers: 3,
      tenants: allTenants.length,
      demoInviteToken: demoToken,
    });

    return {
      managers: { free: mgrA, standard: mgrB, premium: mgrC },
      demoInviteToken: demoToken,
      note: "Use demoInviteToken at /invite/{token} to exercise the tenant portal.",
    };
  },
});
