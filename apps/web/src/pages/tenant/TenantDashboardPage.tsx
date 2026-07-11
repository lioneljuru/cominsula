import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { formatDate, formatMoney } from "@/lib/format";

export function TenantDashboardPage() {
  const data = useQuery(api.me.dashboard);

  if (data === undefined) return <DashboardSkeleton />;

  return (
    <div>
      <PageHeader title="Dashboard" description="Your rent status and reliability standing." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <div className="card p-5">
          <p className="text-sm text-slate-600">Reliability score</p>
          <div className="mt-2"><ScoreBadge score={data.score.score} riskTier={data.score.riskTier} /></div>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-600">Current rent</p>
          <p className="mt-1 text-2xl font-semibold">{data.currentRent !== null ? formatMoney(data.currentRent) : "—"}</p>
          {data.unitLabel && <p className="text-sm text-slate-500">{data.unitLabel}</p>}
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-600">Next due date</p>
          <p className="mt-1 text-2xl font-semibold">{formatDate(data.nextDueDate)}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Latest notice</h2>
          {data.latestNotice ? (
            <p className="text-sm text-slate-700 line-clamp-4">{data.latestNotice.body}</p>
          ) : (
            <p className="text-sm text-slate-500">No notices</p>
          )}
          <Link to="/tenant/notices" className="text-sm text-brand-600 mt-2 inline-block hover:underline">View all notices</Link>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Recent payments</h2>
          {data.recentPayments.length === 0 ? (
            <p className="text-sm text-slate-500">No payments recorded</p>
          ) : (
            <ul className="space-y-2">
              {data.recentPayments.map((p) => (
                <li key={p._id} className="text-sm flex justify-between">
                  <span>{formatMoney(p.amountPaid)}</span>
                  <span className="text-slate-500">{formatDate(p.datePaid)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/tenant/charges" className="text-sm text-brand-600 mt-2 inline-block hover:underline">View payment history</Link>
        </div>
      </div>
    </div>
  );
}
