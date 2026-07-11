import type { Id } from "../_generated/dataModel";

/**
 * The authenticated caller, resolved server-side from the Convex Auth identity.
 * Client-supplied IDs are never trusted; scoping always derives from this.
 */
export type Principal =
  | {
      kind: "manager";
      userId: Id<"users">;
      managerId: Id<"propertyManagers">;
    }
  | {
      kind: "tenant";
      userId: Id<"users">;
      tenantId: Id<"tenants">;
      managerId: Id<"propertyManagers">;
    };
