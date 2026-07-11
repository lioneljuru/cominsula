import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/hooks/useToast";

export function TenantCreatePage() {
  const create = useMutation(api.tenants.create);
  const properties = useQuery(api.properties.list, { paginationOpts: { numItems: 50, cursor: null } });
  const [searchParams] = useSearchParams();
  const prePropertyId = searchParams.get("propertyId");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [propertyId, setPropertyId] = useState(prePropertyId ?? "");
  const [unitId, setUnitId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [leaseStart, setLeaseStart] = useState("");
  const [rent, setRent] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const overview = useQuery(
    api.properties.overview,
    propertyId ? { propertyId: propertyId as Id<"properties"> } : "skip",
  );
  const vacantUnits = overview?.units.filter((u) => u.status === "vacant") ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await create({
        unitId: unitId as Id<"units">,
        fullName,
        email,
        phoneNumber: phone,
        leaseStartDate: leaseStart,
        rentDueAmount: parseFloat(rent),
        dueDayOfMonth: parseInt(dueDay, 10),
      });
      setInviteToken(result.invite_token);
      toast("Tenant invited", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not invite tenant", "error");
    } finally {
      setLoading(false);
    }
  };

  if (inviteToken) {
    return (
      <div>
        <PageHeader title="Tenant invited" />
        <div className="card max-w-lg p-6">
          <p className="text-sm text-slate-600 mb-4">Share this invite link with the tenant (shown once):</p>
          <code className="block rounded bg-slate-100 p-3 text-sm break-all">{`${window.location.origin}/invite/${inviteToken}`}</code>
          <button type="button" className="btn-primary mt-4" onClick={() => navigate("/manager/tenants")}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Invite tenant" />
      <form onSubmit={handleSubmit} className="card max-w-lg p-6 space-y-4">
        <div>
          <label className="label">Property</label>
          <select className="input" value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setUnitId(""); }} required>
            <option value="">Select property</option>
            {properties?.page.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Unit</label>
          <select className="input" value={unitId} onChange={(e) => setUnitId(e.target.value)} required disabled={!propertyId}>
            <option value="">Select vacant unit</option>
            {vacantUnits.map((u) => <option key={u._id} value={u._id}>{u.label} — {u.monthlyRent}</option>)}
          </select>
        </div>
        <div><label className="label">Full name</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
        <div><label className="label">Email</label><input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label className="label">Phone</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
        <div><label className="label">Lease start date</label><input type="date" className="input" value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} required /></div>
        <div><label className="label">Rent due amount</label><input type="number" step="0.01" className="input" value={rent} onChange={(e) => setRent(e.target.value)} required /></div>
        <div><label className="label">Due day of month (1-31)</label><input type="number" min={1} max={31} className="input" value={dueDay} onChange={(e) => setDueDay(e.target.value)} required /></div>
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Inviting…" : "Invite tenant"}</button>
      </form>
    </div>
  );
}
