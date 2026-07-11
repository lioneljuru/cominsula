import type { RiskTier } from "@cominsula/shared";
import { riskBadgeClass, riskLabel } from "@/lib/format";

interface ScoreBadgeProps {
  score: number | null;
  riskTier: RiskTier | string;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, riskTier, size = "md" }: ScoreBadgeProps) {
  const sizeClass =
    size === "sm" ? "text-xs px-2 py-0.5" : size === "lg" ? "text-base px-3 py-1" : "text-sm px-2.5 py-1";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClass} ${riskBadgeClass(riskTier)}`}>
      {score !== null ? <span>{score}</span> : <span>—</span>}
      <span className="opacity-80">· {riskLabel(riskTier)}</span>
    </span>
  );
}
