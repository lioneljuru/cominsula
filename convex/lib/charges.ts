import type { DatabaseWriter, DatabaseReader } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { dueDateFor, billingCycleOf } from "./dates";
import { errConflict } from "./errors";

/** Find an existing charge for an (assignment, billingCycle), or null. */
export async function findCharge(
  db: DatabaseReader,
  assignmentId: Id<"tenantUnitAssignments">,
  billingCycle: string,
): Promise<Doc<"charges"> | null> {
  return await db
    .query("charges")
    .withIndex("by_assignment_cycle", (q) =>
      q.eq("assignmentId", assignmentId).eq("billingCycle", billingCycle),
    )
    .unique();
}

/**
 * Insert a charge for a cycle, snapshotting `amountDue` from the assignment's
 * current rent (§5.5). Normalizes the cycle to the first of its month. Throws
 * CONFLICT if one already exists (the (assignment, cycle) uniqueness invariant).
 */
export async function createCharge(
  db: DatabaseWriter,
  assignment: Doc<"tenantUnitAssignments">,
  billingCycleInput: string,
): Promise<Doc<"charges">> {
  const billingCycle = billingCycleOf(billingCycleInput);
  const existing = await findCharge(db, assignment._id, billingCycle);
  if (existing) errConflict("Charge already exists for this billing cycle");

  const chargeId = await db.insert("charges", {
    assignmentId: assignment._id,
    tenantId: assignment.tenantId,
    managerId: assignment.managerId,
    billingCycle,
    amountDue: assignment.rentDueAmount,
    dueDate: dueDateFor(billingCycle, assignment.dueDayOfMonth),
    createdAt: Date.now(),
  });
  const charge = await db.get(chargeId);
  if (!charge) throw new Error("Charge insert did not return a document");
  return charge;
}

/** Get the charge for a cycle, creating it idempotently if absent (§7.3). */
export async function getOrCreateCharge(
  db: DatabaseWriter,
  assignment: Doc<"tenantUnitAssignments">,
  billingCycleInput: string,
): Promise<Doc<"charges">> {
  const billingCycle = billingCycleOf(billingCycleInput);
  const existing = await findCharge(db, assignment._id, billingCycle);
  if (existing) return existing;
  return await createCharge(db, assignment, billingCycle);
}
