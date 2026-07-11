import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { hashInviteToken } from "./lib/crypto";
import { rateLimiter } from "./lib/rateLimiter";
import { writeAudit } from "./lib/audit";
import {
  errInviteInvalid,
  errUnauthenticated,
  errForbidden,
  errRateLimited,
} from "./lib/errors";
import { logInfo } from "./lib/log";
import type { Doc } from "./_generated/dataModel";

/**
 * Resolve and validate an invite by its raw token. Returns null if the token is
 * missing, expired, or already used - callers surface a single generic error to
 * avoid account enumeration (design v2 §8.5).
 */
async function validInviteByToken(
  db: import("./_generated/server").DatabaseReader,
  rawToken: string,
): Promise<Doc<"tenantInvites"> | null> {
  const invite = await db
    .query("tenantInvites")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hashInviteToken(rawToken)))
    .unique();
  if (!invite) return null;
  if (invite.acceptedAt !== undefined) return null;
  if (invite.expiresAt < Date.now()) return null;
  return invite;
}

/**
 * GET /invites/{token} (§7.10) - the one intentionally anonymous read. Returns
 * only enough to render the accept form (tenant + property name); no financial
 * or score data.
 */
export const lookup = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const invite = await validInviteByToken(ctx.db, token);
    if (!invite) return null;
    const tenant = await ctx.db.get(invite.tenantId);
    if (!tenant) return null;

    const assignment = await ctx.db
      .query("tenantUnitAssignments")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .order("desc")
      .first();
    const unit = assignment ? await ctx.db.get(assignment.unitId) : null;
    const property = unit ? await ctx.db.get(unit.propertyId) : null;

    return {
      tenantName: tenant.fullName,
      tenantEmail: tenant.email,
      propertyName: property?.name ?? null,
      unitLabel: unit?.label ?? null,
    };
  },
});

/**
 * POST /invites/{token}/accept - link half (§6.7 step 3). The frontend creates
 * the Convex Auth account via the standard `signUp` flow first; this mutation
 * (running as the freshly-authenticated user) validates the token, links the
 * user to the pre-existing tenant, marks the tenant active, and burns the token
 * (single-use). Aggressively rate-limited by token.
 */
export const link = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const global = await rateLimiter.limit(ctx, "inviteAcceptGlobal");
    if (!global.ok) errRateLimited();
    const perToken = await rateLimiter.limit(ctx, "inviteAccept", { key: token });
    if (!perToken.ok) errRateLimited();

    const userId = await getAuthUserId(ctx);
    if (!userId) errUnauthenticated();

    // The new account must not already be a manager or another tenant.
    const existingManager = await ctx.db
      .query("propertyManagers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existingManager) errForbidden("This account is already a manager");
    const existingTenant = await ctx.db
      .query("tenants")
      .withIndex("by_authUser", (q) => q.eq("authUserId", userId))
      .unique();
    if (existingTenant) errForbidden("This account is already linked to a tenant");

    const invite = await validInviteByToken(ctx.db, token);
    if (!invite) errInviteInvalid();
    const tenant = await ctx.db.get(invite.tenantId);
    if (!tenant || tenant.inviteStatus === "removed") errInviteInvalid();

    const now = Date.now();
    await ctx.db.patch(tenant._id, {
      authUserId: userId,
      inviteStatus: "active",
    });
    await ctx.db.patch(invite._id, { acceptedAt: now });

    await writeAudit(ctx.db, {
      managerId: invite.managerId,
      tenantId: tenant._id,
      actorType: "tenant",
      actorId: tenant._id,
      entityType: "tenant",
      entityId: tenant._id,
      action: "invite_accepted",
      summary: `${tenant.fullName} accepted their invite`,
    });
    logInfo({ event: "invite_accepted", fn: "invites.link", tenantId: tenant._id });

    return { tenantId: tenant._id };
  },
});
