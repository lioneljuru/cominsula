import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";

export function TenantAccountPage() {
  const dashboard = useQuery(api.me.dashboard);

  if (dashboard === undefined) return <Skeleton className="h-32" />;

  return (
    <div>
      <PageHeader title="Account" description="Read-only profile. Contact your manager to update details." />
      <div className="card max-w-md p-6 space-y-4">
        <div>
          <p className="text-sm text-slate-600">Unit</p>
          <p className="font-medium">{dashboard.unitLabel ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-slate-600">Current rent</p>
          <p className="font-medium">{dashboard.currentRent !== null ? dashboard.currentRent.toFixed(2) : "—"}</p>
        </div>
        <p className="text-sm text-slate-500 pt-4 border-t">
          Password changes are managed through Convex Auth account settings.
        </p>
      </div>
    </div>
  );
}
