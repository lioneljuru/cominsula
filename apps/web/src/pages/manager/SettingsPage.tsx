import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";

export function SettingsPage() {
  const manager = useQuery(api.managers.me);
  const updateProfile = useMutation(api.managers.updateProfile);
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (manager) setFullName(manager.fullName);
  }, [manager]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({ fullName });
      toast("Profile updated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  };

  if (manager === undefined) return <Skeleton className="h-64" />;

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 gap-6 max-w-lg">
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <h2 className="font-semibold">Profile</h2>
          <div><label className="label">Email</label><input className="input bg-slate-50" value={manager?.email ?? ""} disabled /></div>
          <div><label className="label">Full name</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
          <button type="submit" className="btn-primary">Save profile</button>
        </form>
        <div className="card p-6">
          <h2 className="font-semibold mb-2">Password</h2>
          <p className="text-sm text-slate-600">Password changes are managed through Convex Auth. Configure password recovery via your Convex deployment settings.</p>
        </div>
      </div>
    </div>
  );
}
