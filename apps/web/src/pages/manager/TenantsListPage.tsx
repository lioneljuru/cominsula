import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

export function TenantsListPage() {
  const result = useQuery(api.tenants.list, { paginationOpts: { numItems: 50, cursor: null } });

  if (result === undefined) return <TableSkeleton />;

  return (
    <div>
      <PageHeader title="Tenants" actions={<Link to="/manager/tenants/new" className="btn-primary">Invite tenant</Link>} />
      {result.page.length === 0 ? (
        <EmptyState title="No tenants" action={<Link to="/manager/tenants/new" className="btn-primary">Invite tenant</Link>} />
      ) : (
        <div className="card divide-y">
          {result.page.map((t) => (
            <Link key={t._id} to={`/manager/tenants/${t._id}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
              <div>
                <p className="font-medium">{t.fullName}</p>
                <p className="text-sm text-slate-600">{t.email} · {t.inviteStatus}</p>
              </div>
              <span className="text-sm text-brand-600">View →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
