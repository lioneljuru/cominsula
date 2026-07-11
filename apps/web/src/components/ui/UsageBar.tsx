interface UsageBarProps {
  label: string;
  used: number;
  max: number;
}

export function UsageBar({ label, used, max }: UsageBarProps) {
  const unlimited = !Number.isFinite(max);
  const pct = unlimited ? 0 : Math.min(100, (used / max) * 100);
  const atLimit = !unlimited && used >= max;

  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className={atLimit ? "font-medium text-red-600" : "text-slate-900"}>
          {used}/{unlimited ? "∞" : max}
        </span>
      </div>
      {!unlimited && (
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${atLimit ? "bg-red-500" : "bg-brand-600"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
