import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatDateTime } from "@/lib/format";
import { useToast } from "@/hooks/useToast";

export function PropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [tab, setTab] = useState("overview");
  const overview = useQuery(
    api.properties.overview,
    propertyId ? { propertyId: propertyId as Id<"properties"> } : "skip",
  );
  const activity = usePaginatedQuery(
    api.properties.activity,
    propertyId ? { propertyId: propertyId as Id<"properties"> } : "skip",
    { initialNumItems: 20 },
  );

  if (overview === undefined) return <Skeleton className="h-64" />;
  if (!overview) return <EmptyState title="Property not found" />;

  const { property, units } = overview;
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "units", label: "Units" },
    { id: "tenants", label: "Tenants" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div>
      <PageHeader
        title={property.name}
        description={property.address}
        actions={
          <>
            <Link to={`/manager/properties/${propertyId}/edit`} className="btn-secondary">Edit</Link>
            <Link to={`/manager/tenants/new?propertyId=${propertyId}`} className="btn-primary">Invite tenant</Link>
          </>
        }
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="card p-4"><p className="text-sm text-slate-600">Units</p><p className="text-2xl font-semibold">{units.length}</p></div>
            <div className="card p-4"><p className="text-sm text-slate-600">Occupied</p><p className="text-2xl font-semibold">{units.filter((u) => u.status === "occupied").length}</p></div>
          </div>
        )}

        {tab === "units" && (
          <UnitsTab propertyId={propertyId!} units={units} />
        )}

        {tab === "tenants" && (
          <div className="card divide-y">
            {units.filter((u) => u.tenant).map((u) => (
              <Link key={u._id} to={`/manager/tenants/${u.tenant!.tenantId}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
                <div>
                  <p className="font-medium">{u.tenant!.name}</p>
                  <p className="text-sm text-slate-600">{u.label}</p>
                </div>
                <ScoreBadge score={u.tenant!.score} riskTier={u.tenant!.riskTier} size="sm" />
              </Link>
            ))}
            {units.every((u) => !u.tenant) && <EmptyState title="No active tenants" />}
          </div>
        )}

        {tab === "activity" && (
          <div>
            {activity.status === "LoadingFirstPage" ? (
              <TableSkeleton />
            ) : activity.results.length === 0 ? (
              <EmptyState title="No activity" />
            ) : (
              <div className="card divide-y">
                {activity.results.map((log) => (
                  <div key={log._id} className="px-5 py-3">
                    <p className="text-sm text-slate-900">{log.summary}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UnitsTab({ propertyId, units }: { propertyId: string; units: Array<{ _id: string; label: string; monthlyRent: number; status: string; tenant: unknown }> }) {
  const createUnit = useMutation(api.units.create);
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [rent, setRent] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUnit({
        propertyId: propertyId as Id<"properties">,
        label,
        monthlyRent: parseFloat(rent),
      });
      toast("Unit created", "success");
      setShowForm(false);
      setLabel("");
      setRent("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  return (
    <div>
      <div className="mb-4">
        <button type="button" className="btn-secondary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add unit"}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 mb-4 flex flex-wrap gap-4 items-end">
          <div><label className="label">Label</label><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} required /></div>
          <div><label className="label">Monthly rent</label><input className="input" type="number" step="0.01" value={rent} onChange={(e) => setRent(e.target.value)} required /></div>
          <button type="submit" className="btn-primary">Create</button>
        </form>
      )}
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Unit</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Rent</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Tenant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {units.map((u) => (
              <tr key={u._id}>
                <td className="px-4 py-3 text-sm font-medium">{u.label}</td>
                <td className="px-4 py-3 text-sm">{u.monthlyRent.toFixed(2)}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${u.status === "occupied" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}>{u.status}</span></td>
                <td className="px-4 py-3 text-sm">{(u.tenant as { name?: string } | null)?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PropertyEditPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const overview = useQuery(api.properties.overview, propertyId ? { propertyId: propertyId as Id<"properties"> } : "skip");
  const update = useMutation(api.properties.update);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (overview?.property) {
      setName(overview.property.name);
      setAddress(overview.property.address);
    }
  }, [overview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update({ propertyId: propertyId as Id<"properties">, name, address });
      toast("Property updated", "success");
      navigate(`/manager/properties/${propertyId}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  if (!overview) return <Skeleton className="h-64" />;

  return (
    <div>
      <PageHeader title="Edit property" />
      <form onSubmit={handleSubmit} className="card max-w-lg p-6 space-y-4">
        <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div><label className="label">Address</label><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} required /></div>
        <button type="submit" className="btn-primary">Save changes</button>
      </form>
    </div>
  );
}