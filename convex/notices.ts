import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { managerQuery, managerMutation } from "./lib/functions";
import { errNotFound, errInvalidInput } from "./lib/errors";
import { writeAudit } from "./lib/audit";
import { logInfo } from "./lib/log";

/**
 * POST /tenants/{id}/notices (§7.7). Notices are created once and are immutable
 * (§5.9); when score-triggered, `snapshotId` pins the exact score at authoring
 * time so the record is reproducible for a dispute (Fix #3).
 */
export const create = managerMutation({
  args: {
    tenantId: v.id("tenants"),
    body: v.string(),
    snapshotId: v.optional(v.id("tenantScoreSnapshots")),
  },
  handler: async (ctx, { tenantId, body, snapshotId }) => {
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) errNotFound("Tenant not found");
    if (!body.trim()) errInvalidInput("Notice body cannot be empty");

    if (snapshotId) {
      const snapshot = await ctx.db.get(snapshotId);
      if (!snapshot || snapshot.tenantId !== tenantId) {
        errInvalidInput("Linked snapshot does not belong to this tenant");
      }
    }

    const noticeId = await ctx.db.insert("notices", {
      tenantId,
      managerId: ctx.manager._id,
      body,
      snapshotId,
      createdAt: Date.now(),
    });

    await writeAudit(ctx.db, {
      managerId: ctx.manager._id,
      tenantId,
      actorType: "manager",
      actorId: ctx.manager._id,
      entityType: "notice",
      entityId: noticeId,
      action: "created",
      summary: `Issued a notice to ${tenant.fullName}`,
    });
    logInfo({ event: "notice_created", fn: "notices.create", managerId: ctx.manager._id, tenantId });

    return await ctx.db.get(noticeId);
  },
});

/** Per-tenant notice list (manager view), each carrying its pinned score. */
export const listByTenant = managerQuery({
  args: {
    tenantId: v.id("tenants"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { tenantId, paginationOpts }) => {
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) errNotFound("Tenant not found");

    const result = await ctx.db
      .query("notices")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .order("desc")
      .paginate(paginationOpts);

    const page = [];
    for (const notice of result.page) {
      const snapshot = notice.snapshotId
        ? await ctx.db.get(notice.snapshotId)
        : null;
      page.push({
        ...notice,
        snapshot: snapshot
          ? { score: snapshot.score, riskTier: snapshot.riskTier, calculatedAt: snapshot.calculatedAt }
          : null,
      });
    }
    return { ...result, page };
  },
});
