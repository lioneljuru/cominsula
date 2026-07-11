import { usePaginatedQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { billingCycleLabel, formatDate, formatMoney } from "@/lib/format";

export function TenantChargesPage() {
  const payments = usePaginatedQuery(api.me.payments, {}, { initialNumItems: 20 });

  if (payments.status === "LoadingFirstPage") return <TableSkeleton />;

  return (
    <div>
      <PageHeader title="Charges & Payments" description="Your payment history with charge context." />
      {payments.results.length === 0 ? (
        <EmptyState title="No payments yet" />
      ) : (
        <div className="card divide-y">
          {payments.results.map((p) => (
            <div key={p._id} className="px-5 py-4 flex justify-between">
              <div>
                <p className="font-medium">{formatMoney(p.amountPaid)}</p>
                <p className="text-sm text-slate-600">
                  {p.charge ? billingCycleLabel(p.charge.billingCycle) : "—"} · Due {p.charge ? formatDate(p.charge.dueDate) : "—"}
                </p>
              </div>
              <span className="text-sm text-slate-500">{formatDate(p.datePaid)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
