import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Tabs } from "@/components/ui/Tabs";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { formatDateTime, trendArrow } from "@/lib/format";
import { useState } from "react";
import { SCORING, OUTCOME_POINTS } from "@cominsula/shared";

export function TenantScorePage() {
  const [tab, setTab] = useState("current");
  const score = useQuery(api.me.score);
  const history = usePaginatedQuery(api.me.scoreHistory, {}, { initialNumItems: 20 });

  const tabs = [
    { id: "current", label: "Current + Trend" },
    { id: "history", label: "History" },
    { id: "how", label: "How Scoring Works" },
  ];

  return (
    <div>
      <PageHeader title="Reliability Score" />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div className="mt-6">
        {tab === "current" && score && (
          <div className="card p-6">
            <ScoreBadge score={score.score} riskTier={score.riskTier} size="lg" />
            <p className="mt-4 text-sm text-slate-600">
              Trend {trendArrow(score.trend)} · {score.cyclesUsed} cycles · As of {formatDateTime(score.asOf)}
            </p>
            {score.isStale && <p className="mt-2 text-sm text-yellow-700">Score may update when your manager refreshes it.</p>}
          </div>
        )}
        {tab === "history" && (
          history.status === "LoadingFirstPage" ? <TableSkeleton /> : (
            <div className="card divide-y">
              {history.results.map((s) => (
                <div key={s._id} className="flex justify-between px-5 py-3">
                  <ScoreBadge score={s.score} riskTier={s.riskTier} size="sm" />
                  <span className="text-sm text-slate-500">{formatDateTime(s.calculatedAt)}</span>
                </div>
              ))}
            </div>
          )
        )}
        {tab === "how" && (
          <div className="card p-6 prose prose-sm max-w-none">
            <h3 className="font-semibold text-slate-900">How your score is calculated</h3>
            <p className="mt-2 text-sm text-slate-600">
              Your reliability score is based on your {SCORING.WINDOW} most recent completed rent cycles, weighted so recent behavior counts more.
            </p>
            <ul className="mt-4 text-sm space-y-1 text-slate-700">
              {Object.entries(OUTCOME_POINTS).map(([outcome, pts]) => (
                <li key={outcome}><span className="font-medium">{outcome.replace(/_/g, " ")}:</span> {pts} points</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-600">
              Risk tiers: 80–100 Low · 50–79 Medium · 0–49 High. Payments made more than {SCORING.MISS_THRESHOLD_DAYS} days after the due date count as missed, even if the charge is later paid.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
