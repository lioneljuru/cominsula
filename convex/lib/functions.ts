import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
  wrapDatabaseReader,
  wrapDatabaseWriter,
} from "convex-helpers/server/rowLevelSecurity";
import { query, mutation } from "../_generated/server";
import { resolveManager, resolveTenant } from "./authz";
import { rulesFor } from "./rls";

/**
 * Authenticated function builders. Each injects the resolved domain principal
 * and swaps `ctx.db` for an RLS-wrapped db (defaultPolicy "deny"), while keeping
 * the raw db available as `ctx.rawDb` for the few controlled flows (invite
 * linking, session revocation) that must cross the scoped boundary with
 * explicit checks.
 */

const DENY = { defaultPolicy: "deny" } as const;

export const managerQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const { manager, principal } = await resolveManager(ctx);
    return {
      manager,
      principal,
      rawDb: ctx.db,
      db: wrapDatabaseReader(principal, ctx.db, rulesFor(principal), DENY),
    };
  }),
);

export const managerMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const { manager, principal } = await resolveManager(ctx);
    return {
      manager,
      principal,
      rawDb: ctx.db,
      db: wrapDatabaseWriter(principal, ctx.db, rulesFor(principal), DENY),
    };
  }),
);

export const tenantQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const { tenant, principal } = await resolveTenant(ctx);
    return {
      tenant,
      principal,
      rawDb: ctx.db,
      db: wrapDatabaseReader(principal, ctx.db, rulesFor(principal), DENY),
    };
  }),
);

export const tenantMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const { tenant, principal } = await resolveTenant(ctx);
    return {
      tenant,
      principal,
      rawDb: ctx.db,
      db: wrapDatabaseWriter(principal, ctx.db, rulesFor(principal), DENY),
    };
  }),
);
