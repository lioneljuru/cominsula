import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/hooks/useToast";

export function PropertyCreatePage() {
  const create = useMutation(api.properties.create);
  const limits = useQuery(api.managers.getLimits);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const atLimit = limits && Number.isFinite(limits.properties.max) && limits.properties.used >= limits.properties.max;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const property = await create({ name, address });
      toast("Property created", "success");
      navigate(`/manager/properties/${property!._id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create property", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Create property" />
      {atLimit && (
        <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Property limit reached. Upgrade your plan to add more properties.
        </div>
      )}
      <form onSubmit={handleSubmit} className="card max-w-lg p-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">Property name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required disabled={atLimit} />
        </div>
        <div>
          <label className="label" htmlFor="address">Address</label>
          <input id="address" className="input" value={address} onChange={(e) => setAddress(e.target.value)} required disabled={atLimit} />
        </div>
        <button type="submit" className="btn-primary" disabled={loading || atLimit}>
          {loading ? "Creating…" : "Create property"}
        </button>
      </form>
    </div>
  );
}
