import { getLedgerEvents } from "@/lib/db";
import { GitPullRequest, Monitor, Bot, User } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AuditTrailPage() {
  const events = getLedgerEvents({ limit: 100 });

  return (
    <div className="p-8">
      <div className="max-w-7xl">
        <h1 className="text-xl font-semibold text-devin-text-primary mb-1">
          Activity & Audit Trail
        </h1>
        <p className="text-[13px] text-devin-text-secondary mb-8">
          Every triage decision, routing rule, and outcome.
        </p>

        <div className="overflow-x-auto rounded-lg border border-devin-border">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-devin-border text-devin-text-secondary">
                <th className="text-left py-3 px-4 font-medium text-[13px]">Time</th>
                <th className="text-left py-3 px-4 font-medium text-[13px]">Issue</th>
                <th className="text-left py-3 px-4 font-medium text-[13px]">Title</th>
                <th className="text-left py-3 px-4 font-medium text-[13px]">Action</th>
                <th className="text-left py-3 px-4 font-medium text-[13px]">Path</th>
                <th className="text-left py-3 px-4 font-medium text-[13px]">Team</th>
                <th className="text-left py-3 px-4 font-medium text-[13px]">Resolved By</th>
                <th className="text-left py-3 px-4 font-medium text-[13px]">Links</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-12 text-devin-text-secondary"
                  >
                    No events yet. Trigger a triage to get started.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr
                    key={event.event_id}
                    className="border-b border-devin-border/50 hover:bg-devin-hover transition-colors"
                  >
                    <td className="py-3 px-4 text-devin-text-secondary text-[13px]">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-[13px]">
                      <a
                        href={`https://linear.app/tailored-sdk/issue/${event.issue_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-devin-accent hover:text-devin-accent-bright transition-colors"
                      >
                        {event.issue_id}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-[13px] text-devin-text-primary max-w-[250px] truncate" title={event.issue_title ?? ""}>
                      {event.issue_title || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[13px] font-medium ${getActionColor(event.action)}`}
                      >
                        {event.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-devin-text-secondary text-[13px]">
                      {event.path?.replace("path_", "").replace(/_/g, " ") ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-devin-text-secondary text-[13px]">
                      {event.responsible_team ?? "—"}
                    </td>
                    <td className="py-3 px-4">
                      {getResolvedBy(event)}
                    </td>
                    <td className="py-3 px-4 flex items-center gap-3">
                      {event.devin_session_url && (
                        <a
                          href={event.devin_session_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-devin-accent hover:text-devin-accent-bright transition-colors"
                          title="View Devin session"
                        >
                          <Monitor size={14} />
                        </a>
                      )}
                      {event.pr_url && (
                        <a
                          href={event.pr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-devin-accent hover:text-devin-accent-bright transition-colors"
                          title="View PR"
                        >
                          <GitPullRequest size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getResolvedBy(event: { action: string; metadata: Record<string, unknown> | null }) {
  const devinActions = ["auto_dispatched", "approval_granted", "job_started", "pr_created", "pr_merged", "policy_overridden", "clarification_resolved"];
  const humanActions = ["human_claimed"];

  if (devinActions.includes(event.action)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[12px] font-medium bg-devin-accent/10 text-devin-accent">
        <Bot size={12} />
        Devin
      </span>
    );
  }

  if (humanActions.includes(event.action)) {
    const claimedBy = event.metadata?.claimed_by as string | undefined;
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[12px] font-medium bg-purple-500/10 text-purple-400">
        <User size={12} />
        {claimedBy ?? "Human"}
      </span>
    );
  }

  return <span className="text-devin-text-secondary text-[13px]">—</span>;
}

function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    auto_dispatched: "bg-emerald-500/10 text-emerald-400",
    approval_requested: "bg-devin-amber/10 text-devin-amber",
    approval_granted: "bg-emerald-500/10 text-emerald-400",
    approval_declined: "bg-red-500/10 text-red-400",
    policy_blocked: "bg-red-500/10 text-red-400",
    policy_overridden: "bg-devin-amber/10 text-devin-amber",
    clarification_requested: "bg-devin-accent/10 text-devin-accent",
    clarification_resolved: "bg-emerald-500/10 text-emerald-400",
    human_claimed: "bg-purple-500/10 text-purple-400",
    pr_created: "bg-emerald-500/10 text-emerald-400",
    pr_merged: "bg-emerald-500/10 text-emerald-400",
    routing_corrected: "bg-devin-amber/10 text-devin-amber",
    triage_started: "bg-devin-bg-component text-devin-text-secondary",
    triage_completed: "bg-devin-bg-component text-devin-text-primary",
    job_started: "bg-devin-accent/10 text-devin-accent",
    job_completed: "bg-emerald-500/10 text-emerald-400",
    job_failed: "bg-red-500/10 text-red-400",
  };
  return colors[action] ?? "bg-devin-bg-component text-devin-text-secondary";
}
