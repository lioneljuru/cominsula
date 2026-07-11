import { usePaginatedQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";

export function TenantNoticesPage() {
  const notices = usePaginatedQuery(api.me.notices, {}, { initialNumItems: 20 });

  if (notices.status === "LoadingFirstPage") return <TableSkeleton />;

  return (
    <div>
      <PageHeader title="Notices" description="Formal notices from your property manager (read-only)." />
      {notices.results.length === 0 ? (
        <EmptyState title="No notices" />
      ) : (
        <div className="card divide-y">
          {notices.results.map((n) => (
            <div key={n._id} className="p-5">
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              <p className="mt-2 text-xs text-slate-500">{formatDateTime(n.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
