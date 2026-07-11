import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from "@cominsula/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsageBar } from "@/components/ui/UsageBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { tierDisplayName } from "@/lib/format";
import { useToast } from "@/hooks/useToast";

export function SubscriptionPage() {
  const limits = useQuery(api.managers.getLimits);
  const setTier = useMutation(api.managers.setTier);
  const { toast } = useToast();
  const [selected, setSelected] = useState<SubscriptionTier | null>(null);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (limits === undefined) return <Skeleton className="h-64" />;

  const handleChange = async (tier: SubscriptionTier) => {
    if (tier === limits.tier) return;
    setLoading(true);
    setError("");
    try {
      await setTier({ tier });
      toast(`Plan changed to ${tierDisplayName(tier)}`, "success");
      setSelected(null);
      setConfirmDowngrade(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not change plan";
      setError(msg);
      if (msg.includes("downgrade") || msg.includes("exceeds")) {
        setConfirmDowngrade(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Subscription" description="Self-service plan management (unmetered in MVP)." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">Current usage</h2>
          <UsageBar label="Properties" used={limits.properties.used} max={limits.properties.max} />
          {Object.entries(limits.tenantsByProperty).map(([id, u]) => (
            <UsageBar key={id} label={`Tenants (${id.slice(-6)})`} used={u.used} max={u.max} />
          ))}
        </div>
        <div className="card p-6">
          <h2 className="font-semibold mb-4">Change plan</h2>
          <p className="text-sm text-slate-600 mb-4">Current: <span className="capitalize font-medium">{limits.tier}</span></p>
          <div className="space-y-2">
            {SUBSCRIPTION_TIERS.map((tier) => (
              <button
                key={tier}
                type="button"
                className={`w-full rounded-md border px-4 py-3 text-left text-sm ${limits.tier === tier ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}
                onClick={() => { setSelected(tier); handleChange(tier); }}
                disabled={loading}
              >
                {tierDisplayName(tier)}
              </button>
            ))}
          </div>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </div>
      <ConfirmDialog
        open={confirmDowngrade}
        title="Cannot downgrade"
        message={error || "Current usage exceeds the target tier limits."}
        confirmLabel="OK"
        onConfirm={() => setConfirmDowngrade(false)}
        onCancel={() => setConfirmDowngrade(false)}
      />
    </div>
  );
}
