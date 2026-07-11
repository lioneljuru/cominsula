import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { UsageBar } from "@/components/ui/UsageBar";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

export function ManagerDashboardPage() {
  const dashboard = useQuery(api.dashboard.get);
  const limits = useQuery(api.managers.getLimits);

  if (dashboard === undefined) return <DashboardSkeleton />;

  const { summary, attention, subscription } = dashboard;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Portfolio overview — read-only, updated in real time."
        actions={
          <>
            <Link to="/manager/properties/new" className="btn-secondary">Create property</Link>
            <Link to="/manager/tenants/new" className="btn-primary">Invite tenant</Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[
          { label: "Total Units", value: summary.totalUnits },
          { label: "Occupied Units", value: summary.occupiedUnits },
          { label: "High-Risk Tenants", value: summary.highRiskTenants, alert: summary.highRiskTenants > 0 },
          { label: "Overdue This Month", value: summary.overdueThisMonth, alert: summary.overdueThisMonth > 0 },
        ].map((card) => (
          <div key={card.label} className="card p-5">
            <p className="text-sm text-slate-600">{card.label}</p>
            <p className={`mt-1 text-3xl font-semibold ${card.alert ? "text-red-600" : "text-slate-900"}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Tenants requiring attention</h2>
          {attention.length === 0 ? (
            <EmptyState title="No tenants yet" description="Invite tenants to start tracking reliability scores." action={<Link to="/manager/tenants/new" className="btn-primary">Invite tenant</Link>} />
          ) : (
            <div className="card overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Tenant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Score</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attention.map((row) => (
                    <tr key={row.tenantId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.name}</td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={row.score} riskTier={row.riskTier} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/manager/tenants/${row.tenantId}`} className="text-sm text-brand-600 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Subscription usage</h2>
          <div className="card p-5 space-y-4">
            <p className="text-sm text-slate-600">
              Current plan: <span className="font-medium capitalize text-slate-900">{subscription.tier}</span>
            </p>
            <UsageBar label="Properties" used={subscription.propertiesUsed} max={subscription.propertiesMax} />
            {limits && Object.entries(limits.tenantsByProperty).slice(0, 3).map(([propId, usage]) => (
              <UsageBar key={propId} label={`Tenants (property)`} used={usage.used} max={usage.max} />
            ))}
            <Link to="/manager/subscription" className="btn-secondary w-full text-center block">
              Change plan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
