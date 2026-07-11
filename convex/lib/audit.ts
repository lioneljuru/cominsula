import type { DatabaseWriter } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { ActorType } from "@cominsula/shared";

/**
 * Append an AuditLog entry (Addendum A1). Written as a side effect inside the
 * same transaction as the mutation it records - no new write paths, and never
 * on reads. `summary` is a short human line, not a full field diff.
 */
export async function writeAudit(
  db: DatabaseWriter,
  entry: {
    managerId: Id<"propertyManagers">;
    tenantId?: Id<"tenants">;
    propertyId?: Id<"properties">;
    actorType: ActorType;
    actorId: string;
    entityType: string;
    entityId: string;
    action: string;
    summary: string;
  },
): Promise<void> {
  await db.insert("auditLogs", { ...entry, createdAt: Date.now() });
}
