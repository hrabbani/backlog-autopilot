import { getMetrics, getLedgerEvents } from "@/lib/db";
import { TrendingUp, GitPullRequest, CheckCircle, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default function MetricsPage() {
  const metrics = getMetrics();
  const recentEvents = getLedgerEvents({ limit: 10 });

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-xl font-semibold text-devin-text-primary mb-1">
          Metrics & ROI
        </h1>
        <p className="text-[13px] text-devin-text-secondary mb-8">
          System performance and backlog health.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <MetricCard
            icon={<CheckCircle size={16} className="text-emerald-400" />}
            label="Issues Triaged"
            value={metrics.issues_triaged}
          />
          <MetricCard
            icon={<GitPullRequest size={16} className="text-devin-accent" />}
            label="PRs Created"
            value={metrics.prs_created}
          />
          <MetricCard
            icon={<TrendingUp size={16} className="text-emerald-400" />}
            label="PRs Merged"
            value={metrics.prs_merged}
          />
          <MetricCard
            icon={<Target size={16} className="text-devin-amber" />}
            label="Avg Confidence"
            value={metrics.avg_confidence != null ? `${(metrics.avg_confidence * 100).toFixed(0)}%` : "—"}
          />
        </div>

        <h2 className="text-[14px] font-semibold text-devin-text-primary mb-4">
          Recent Activity
        </h2>
        <div className="space-y-1">
          {recentEvents.length === 0 ? (
            <p className="text-devin-text-secondary text-[14px] py-8 text-center">
              No activity yet.
            </p>
          ) : (
            recentEvents.map((event) => (
              <div
                key={event.event_id}
                className="bg-devin-bg-surface border border-devin-border/50 rounded-md px-4 py-3 flex justify-between items-center hover:bg-devin-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px] text-devin-text-primary">
                    {event.issue_id}
                  </span>
                  <span className="text-devin-text-secondary text-[13px]">
                    {event.action.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-devin-text-secondary text-[13px]">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-devin-bg-surface border border-devin-border rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="text-devin-text-secondary text-[13px]">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-devin-text-primary">{value}</p>
    </div>
  );
}
