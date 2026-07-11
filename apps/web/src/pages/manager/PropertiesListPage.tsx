import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

export function PropertiesListPage() {
  const result = useQuery(api.properties.list, { paginationOpts: { numItems: 50, cursor: null } });

  if (result === undefined) return <TableSkeleton />;

  return (
    <div>
      <PageHeader
        title="Properties"
        actions={<Link to="/manager/properties/new" className="btn-primary">Create property</Link>}
      />
      {result.page.length === 0 ? (
        <EmptyState title="No properties" description="Create your first property to start managing units and tenants." action={<Link to="/manager/properties/new" className="btn-primary">Create property</Link>} />
      ) : (
        <div className="card divide-y divide-slate-100">
          {result.page.map((p) => (
            <Link key={p._id} to={`/manager/properties/${p._id}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
              <div>
                <p className="font-medium text-slate-900">{p.name}</p>
                <p className="text-sm text-slate-600">{p.address}</p>
              </div>
              <span className="text-sm text-brand-600">View →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
