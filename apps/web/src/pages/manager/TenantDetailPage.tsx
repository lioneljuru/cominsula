import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { billingCycleLabel, formatDate, formatDateTime, formatMoney, trendArrow } from "@/lib/format";
import { useToast } from "@/hooks/useToast";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "lease", label: "Current Lease" },
  { id: "charges", label: "Charges" },
  { id: "score", label: "Reliability Score" },
  { id: "history", label: "Score History" },
  { id: "breakdown", label: "Score Breakdown" },
  { id: "notices", label: "Notices" },
  { id: "activity", label: "Activity" },
];

export function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [tab, setTab] = useState("overview");
  const tid = tenantId as Id<"tenants">;

  const profile = useQuery(api.tenants.get, tenantId ? { tenantId: tid } : "skip");
  const score = useQuery(api.scores.get, tenantId ? { tenantId: tid } : "skip");

  if (profile === undefined) return <Skeleton className="h-64" />;
  if (!profile?.tenant) return <EmptyState title="Tenant not found" />;

  const { tenant, assignment, unit, property } = profile;

  return (
    <div>
      <PageHeader
        title={tenant.fullName}
        description={`${tenant.email} · ${tenant.phoneNumber}`}
        actions={
          <>
            <Link to={`/manager/tenants/${tenantId}/edit`} className="btn-secondary">Edit</Link>
            <TenantActions tenantId={tid} tenantName={tenant.fullName} />
          </>
        }
      />

      {score && (
        <div className="mb-6 flex items-center gap-4">
          <ScoreBadge score={score.score} riskTier={score.riskTier} size="lg" />
          <span className="text-sm text-slate-600">
            Trend {trendArrow(score.trend)} {score.isStale && "(stale — refresh recommended)"}
          </span>
        </div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="mt-6">
        {tab === "overview" && (
          <div className="card p-6 space-y-3">
            <p><span className="text-slate-600">Status:</span> <span className="capitalize">{tenant.inviteStatus}</span></p>
            <p><span className="text-slate-600">Property:</span> {property?.name ?? "—"}</p>
            <p><span className="text-slate-600">Unit:</span> {unit?.label ?? "—"}</p>
            {assignment && (
              <>
                <p><span className="text-slate-600">Rent:</span> {formatMoney(assignment.rentDueAmount)}</p>
                <p><span className="text-slate-600">Lease:</span> {formatDate(assignment.leaseStartDate)} — {assignment.leaseEndDate ? formatDate(assignment.leaseEndDate) : "Active"}</p>
              </>
            )}
          </div>
        )}
        {tab === "lease" && assignment && (
          <div className="card p-6 space-y-2">
            <p>Rent: {formatMoney(assignment.rentDueAmount)} due day {assignment.dueDayOfMonth}</p>
            <p>Start: {formatDate(assignment.leaseStartDate)}</p>
          </div>
        )}
        {tab === "charges" && <ChargesTab tenantId={tid} assignmentId={assignment?._id} />}
        {tab === "score" && <ScoreTab tenantId={tid} score={score} />}
        {tab === "history" && <ScoreHistoryTab tenantId={tid} />}
        {tab === "breakdown" && <BreakdownTab tenantId={tid} />}
        {tab === "notices" && <NoticesTab tenantId={tid} />}
        {tab === "activity" && <ActivityTab tenantId={tid} />}
      </div>
    </div>
  );
}

function TenantActions({ tenantId, tenantName }: { tenantId: Id<"tenants">; tenantName: string }) {
  const remove = useMutation(api.tenants.remove);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRemove = async () => {
    setLoading(true);
    try {
      await remove({ tenantId });
      toast("Tenant removed", "success");
      navigate("/manager/tenants");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
      setConfirmRemove(false);
    }
  };

  return (
    <>
      <button type="button" className="btn-danger" onClick={() => setConfirmRemove(true)}>Remove</button>
      <ConfirmDialog
        open={confirmRemove}
        title="Remove tenant"
        message={`Remove ${tenantName}? Their history will be retained but portal access will be revoked.`}
        confirmLabel="Remove tenant"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
        loading={loading}
      />
    </>
  );
}

function ScoreTab({ tenantId, score }: { tenantId: Id<"tenants">; score: { score: number | null; riskTier: string; isStale: boolean; asOf: number | null; cyclesUsed: number } | undefined }) {
  const recalculate = useMutation(api.scores.recalculate);
  const [loading, setLoading] = useState(false);
  const [tierChanged, setTierChanged] = useState(false);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const result = await recalculate({ tenantId });
      if (result.tier_changed) {
        setTierChanged(true);
        setSnapshotId(result.snapshot_id);
      }
      toast("Score refreshed", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6">
      {score && (
        <>
          <ScoreBadge score={score.score} riskTier={score.riskTier} size="lg" />
          <p className="mt-4 text-sm text-slate-600">As of: {formatDateTime(score.asOf)} · {score.cyclesUsed} cycles</p>
          {score.isStale && (
            <button type="button" className="btn-primary mt-4" onClick={handleRefresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh score"}
            </button>
          )}
          {tierChanged && snapshotId && (
            <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">Risk tier worsened. Consider drafting a notice.</p>
              <Link to={`/manager/tenants/${tenantId}?tab=notices&draft=${snapshotId}`} className="btn-secondary mt-2 inline-block text-sm">
                Draft notice
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ChargesTab({ tenantId, assignmentId }: { tenantId: Id<"tenants">; assignmentId?: Id<"tenantUnitAssignments"> }) {
  const charges = usePaginatedQuery(api.charges.listByTenant, { tenantId }, { initialNumItems: 20 });
  const recordPayment = useMutation(api.payments.record);
  const createCharge = useMutation(api.charges.create);
  const { toast } = useToast();
  const [payChargeId, setPayChargeId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [datePaid, setDatePaid] = useState(new Date().toISOString().slice(0, 10));
  const [newCycle, setNewCycle] = useState("");

  const handlePay = async (chargeId: Id<"charges">) => {
    try {
      await recordPayment({ chargeId, amountPaid: parseFloat(amount), datePaid });
      toast("Payment recorded", "success");
      setPayChargeId(null);
      setAmount("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Payment failed", "error");
    }
  };

  const handleCreateCharge = async () => {
    if (!assignmentId || !newCycle) return;
    try {
      await createCharge({ assignmentId, billingCycle: `${newCycle}-01` });
      toast("Charge created", "success");
      setNewCycle("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  if (charges.status === "LoadingFirstPage") return <TableSkeleton />;

  return (
    <div>
      {assignmentId && (
        <div className="mb-4 flex gap-2 items-end">
          <div><label className="label">New billing cycle (YYYY-MM)</label><input className="input" placeholder="2026-07" value={newCycle} onChange={(e) => setNewCycle(e.target.value)} /></div>
          <button type="button" className="btn-secondary" onClick={handleCreateCharge}>Create charge</button>
        </div>
      )}
      <div className="card divide-y">
        {charges.results.map((c) => (
          <div key={c._id} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{billingCycleLabel(c.billingCycle)}</p>
                <p className="text-sm text-slate-600">Due {formatDate(c.dueDate)} · {c.status} · {formatMoney(c.amountCollected)}/{formatMoney(c.amountDue)}</p>
              </div>
              {c.status !== "paid" && (
                payChargeId === c._id ? (
                  <div className="flex gap-2 items-end">
                    <input type="number" step="0.01" className="input w-24" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
                    <input type="date" className="input" value={datePaid} onChange={(e) => setDatePaid(e.target.value)} />
                    <button type="button" className="btn-primary text-sm" onClick={() => handlePay(c._id)}>Save</button>
                    <button type="button" className="btn-secondary text-sm" onClick={() => setPayChargeId(null)}>Cancel</button>
                  </div>
                ) : (
                  <button type="button" className="btn-primary text-sm" onClick={() => setPayChargeId(c._id)}>Record payment</button>
                )
              )}
            </div>
            {c.installments.length > 0 && (
              <ul className="mt-2 text-xs text-slate-500 space-y-1">
                {c.installments.map((p) => (
                  <li key={p._id}>{formatMoney(p.amountPaid)} on {formatDate(p.datePaid)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {charges.results.length === 0 && <EmptyState title="No charges" />}
      </div>
    </div>
  );
}

function ScoreHistoryTab({ tenantId }: { tenantId: Id<"tenants"> }) {
  const history = usePaginatedQuery(api.scores.history, { tenantId }, { initialNumItems: 20 });
  if (history.status === "LoadingFirstPage") return <TableSkeleton />;
  return (
    <div className="card divide-y">
      {history.results.map((s) => (
        <div key={s._id} className="flex justify-between px-5 py-3">
          <ScoreBadge score={s.score} riskTier={s.riskTier} size="sm" />
          <span className="text-sm text-slate-500">{formatDateTime(s.calculatedAt)} · {s.trigger}</span>
        </div>
      ))}
      {history.results.length === 0 && <EmptyState title="No score history" />}
    </div>
  );
}

function BreakdownTab({ tenantId }: { tenantId: Id<"tenants"> }) {
  const breakdown = useQuery(api.scores.breakdown, { tenantId });
  if (breakdown === undefined) return <TableSkeleton />;
  return (
    <div className="card overflow-hidden">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs uppercase text-slate-500">Cycle</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-slate-500">Outcome</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-slate-500">Points</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-slate-500">Weight</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {breakdown.cycles.map((c) => (
            <tr key={c.billingCycle}>
              <td className="px-4 py-2 text-sm">{billingCycleLabel(c.billingCycle)}</td>
              <td className="px-4 py-2 text-sm">{c.outcome}</td>
              <td className="px-4 py-2 text-sm">{c.points}</td>
              <td className="px-4 py-2 text-sm">{c.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="p-4 text-sm font-medium">Computed score: {breakdown.score ?? "Unrated"}</p>
    </div>
  );
}

function NoticesTab({ tenantId }: { tenantId: Id<"tenants"> }) {
  const notices = usePaginatedQuery(api.notices.listByTenant, { tenantId }, { initialNumItems: 20 });
  const createNotice = useMutation(api.notices.create);
  const [body, setBody] = useState("");
  const { toast } = useToast();

  const handleCreate = async () => {
    try {
      await createNotice({ tenantId, body });
      toast("Notice saved", "success");
      setBody("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  return (
    <div>
      <div className="card p-4 mb-4">
        <label className="label">Draft notice (immutable once saved)</label>
        <textarea className="input min-h-[100px]" value={body} onChange={(e) => setBody(e.target.value)} />
        <button type="button" className="btn-primary mt-2" onClick={handleCreate} disabled={!body.trim()}>Save notice</button>
      </div>
      <div className="card divide-y">
        {notices.results.map((n) => (
          <div key={n._id} className="p-4">
            <p className="text-sm whitespace-pre-wrap">{n.body}</p>
            <p className="mt-2 text-xs text-slate-500">{formatDateTime(n.createdAt)} {n.snapshot && `· Score ${n.snapshot.score} (${n.snapshot.riskTier})`}</p>
          </div>
        ))}
        {notices.results.length === 0 && <EmptyState title="No notices" />}
      </div>
    </div>
  );
}

function ActivityTab({ tenantId }: { tenantId: Id<"tenants"> }) {
  const activity = usePaginatedQuery(api.tenants.activity, { tenantId }, { initialNumItems: 20 });
  if (activity.status === "LoadingFirstPage") return <TableSkeleton />;
  return (
    <div className="card divide-y">
      {activity.results.map((log) => (
        <div key={log._id} className="px-5 py-3">
          <p className="text-sm">{log.summary}</p>
          <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
        </div>
      ))}
      {activity.results.length === 0 && <EmptyState title="No activity" />}
    </div>
  );
}

export function TenantEditPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const profile = useQuery(api.tenants.get, tenantId ? { tenantId: tenantId as Id<"tenants"> } : "skip");
  const update = useMutation(api.tenants.update);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile?.tenant) {
      setFullName(profile.tenant.fullName);
      setPhone(profile.tenant.phoneNumber);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update({ tenantId: tenantId as Id<"tenants">, fullName, phoneNumber: phone });
      toast("Tenant updated", "success");
      navigate(`/manager/tenants/${tenantId}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  if (!profile) return <Skeleton className="h-64" />;

  return (
    <div>
      <PageHeader title="Edit tenant" />
      <form onSubmit={handleSubmit} className="card max-w-lg p-6 space-y-4">
        <div><label className="label">Full name</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
        <div><label className="label">Phone</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
        <button type="submit" className="btn-primary">Save</button>
      </form>
    </div>
  );
}
