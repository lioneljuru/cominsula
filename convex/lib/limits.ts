import type { DatabaseReader } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { TIER_LIMITS } from "@cominsula/shared";
import { errLimitReached } from "./errors";
import { critical } from "./log";

/**
 * Subscription-limit enforcement (PRD §6.4). The FOR-UPDATE row lock the PRD
 * specifies for Postgres is unnecessary here: a Convex mutation is serializable,
 * so the count read + insert are atomic and a concurrent request that would
 * over-allocate conflicts and retries against a fresh count. These helpers are
 * wrapped in `critical()` so an enforcement bug fails loudly (PRD §11).
 */

export async function countProperties(
  db: DatabaseReader,
  managerId: Id<"propertyManagers">,
): Promise<number> {
  const rows = await db
    .query("properties")
    .withIndex("by_manager", (q) => q.eq("managerId", managerId))
    .collect();
  return rows.length;
}

/** Active (open-lease) assignments within a property = "tenants" for §6.4. */
export async function countActiveTenantsForProperty(
  db: DatabaseReader,
  propertyId: Id<"properties">,
): Promise<number> {
  const rows = await db
    .query("tenantUnitAssignments")
    .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
    .collect();
  return rows.filter((a) => a.active).length;
}

export async function enforcePropertyLimit(
  db: DatabaseReader,
  manager: Doc<"propertyManagers">,
): Promise<void> {
  await critical("enforcePropertyLimit", { managerId: manager._id }, async () => {
    const max = TIER_LIMITS[manager.subscriptionTier].properties;
    if (!Number.isFinite(max)) return;
    const used = await countProperties(db, manager._id);
    if (used >= max) {
      errLimitReached(
        `Property limit reached for the ${manager.subscriptionTier} tier (${max})`,
      );
    }
  });
}

export async function enforceTenantLimit(
  db: DatabaseReader,
  manager: Doc<"propertyManagers">,
  propertyId: Id<"properties">,
): Promise<void> {
  await critical(
    "enforceTenantLimit",
    { managerId: manager._id, propertyId },
    async () => {
      const max = TIER_LIMITS[manager.subscriptionTier].tenantsPerProperty;
      if (!Number.isFinite(max)) return;
      const used = await countActiveTenantsForProperty(db, propertyId);
      if (used >= max) {
        errLimitReached("Tenant limit reached for this property");
      }
    },
  );
}
