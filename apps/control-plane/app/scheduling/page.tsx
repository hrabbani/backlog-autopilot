"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Clock, Loader2, Terminal } from "lucide-react";

const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:3001";

const SWEEP_BATCH_SIZE = 3;

interface SweepResult {
  status: string;
  processed: string[];
  skipped: string[];
  blocked: string[];
  errors: Array<{ issueId: string; error: string }>;
}

interface LogEvent {
  event_id: string;
  timestamp: string;
  issue_id: string;
  issue_title: string;
  action: string;
  path: string | null;
  responsible_team: string | null;
  devin_session_url: string | null;
  pr_url: string | null;
  metadata: Record<string, unknown> | null;
}

function describeEvent(event: LogEvent): { text: string; color: string } {
  const title = event.issue_title || event.issue_id;
  const team = event.responsible_team;
  const meta = event.metadata as Record<string, string> | null;

  switch (event.action) {
    case "triage_started":
      return { text: `Triaging ${title}...`, color: "text-devin-text-secondary" };
    case "triage_completed":
      return {
        text: `Triage complete for ${title}` + (team ? ` → routed to ${team}` : ""),
        color: "text-devin-text-primary",
      };
    case "auto_dispatched":
      return { text: `Auto-fixing ${title}`, color: "text-emerald-400" };
    case "approval_requested":
      return {
        text: `Requesting approval to fix ${title}` + (team ? ` from ${team}` : ""),
        color: "text-amber-400",
      };
    case "approval_granted":
      return {
        text: `${title} approved` + (meta?.approved_by ? ` by <${meta.approved_by}>` : ""),
        color: "text-emerald-400",
      };
    case "policy_blocked": {
      const reason = meta?.blocked_by ?? "policy";
      return { text: `Blocked ${title} — ${reason.replace(/_/g, " ")}`, color: "text-red-400" };
    }
    case "policy_overridden":
      return { text: `Policy override for ${title}`, color: "text-amber-400" };
    case "clarification_requested": {
      const question = meta?.clarification_question as string | undefined;
      return {
        text: `Needs clarification on ${title}` + (question ? `: "${question.slice(0, 80)}${question.length > 80 ? "…" : ""}"` : ""),
        color: "text-blue-400",
      };
    }
    case "clarification_resolved":
      return { text: `Clarification received for ${title}, dispatching fix`, color: "text-emerald-400" };
    case "job_started":
      return { text: `Working on a fix for ${title}...`, color: "text-blue-400" };
    case "job_completed":
      return { text: `Fix complete for ${title}`, color: "text-emerald-400" };
    case "pr_created":
      return { text: `Opened PR for ${title}`, color: "text-emerald-400" };
    case "pr_merged":
      return { text: `PR merged for ${title}`, color: "text-emerald-400" };
    case "routing_corrected":
      return {
        text: `Routing corrected for ${title}` + (meta?.corrected_to ? ` → ${meta.corrected_to}` : ""),
        color: "text-amber-400",
      };
    case "human_claimed":
      return { text: `${title} claimed by a team member`, color: "text-purple-400" };
    default:
      return { text: `${event.action.replace(/_/g, " ")} — ${title}`, color: "text-devin-text-secondary" };
  }
}

export default function SchedulingPage() {
  const [nextSweepMs, setNextSweepMs] = useState(SWEEP_INTERVAL_MS);
  const [sweepRunning, setSweepRunning] = useState(false);
  const [lastResult, setLastResult] = useState<SweepResult | null>(null);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [logPolling, setLogPolling] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set<string>());

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setNextSweepMs((prev) => {
        if (prev <= 1000) return SWEEP_INTERVAL_MS;
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll orchestrator logs when active
  useEffect(() => {
    if (!logPolling) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${ORCHESTRATOR_URL}/api/logs`);
        const data = await res.json();
        const events = (data.events as LogEvent[]) ?? [];
        // Reverse so oldest first, filter to only new events
        const reversed = [...events].reverse();
        const newEvents = reversed.filter((e) => !seenIds.current.has(e.event_id));
        if (newEvents.length > 0) {
          newEvents.forEach((e) => seenIds.current.add(e.event_id));
          setLogs((prev) => [...prev, ...newEvents]);
        }
      } catch {
        // Orchestrator might not be running yet
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [logPolling]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const triggerSweep = useCallback(async () => {
    setSweepRunning(true);
    setLastResult(null);
    setLogPolling(true);
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/api/sweep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: SWEEP_BATCH_SIZE }),
      });
      const data = (await res.json()) as SweepResult;
      setLastResult(data);
      setNextSweepMs(SWEEP_INTERVAL_MS);
    } catch (err) {
      setLastResult({
        status: "error",
        processed: [],
        skipped: [],
        blocked: [],
        errors: [{ issueId: "N/A", error: err instanceof Error ? err.message : "Failed to reach orchestrator" }],
      });
    } finally {
      setSweepRunning(false);
    }
  }, []);

  return (
    <div className="p-8">
      <div className="max-w-4xl">
        <h1 className="text-xl font-semibold text-devin-text-primary mb-1">
          Scheduling
        </h1>
        <p className="text-[13px] text-devin-text-secondary mb-8">
          Backlog sweep configuration and manual trigger.
        </p>

        {/* Sweep status card */}
        <div className="rounded-lg border border-devin-border bg-devin-bg-sidebar p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock size={16} className="text-devin-text-secondary" />
                <span className="text-[13px] text-devin-text-secondary">Next sweep in</span>
              </div>
              <span className="text-3xl font-mono font-semibold text-devin-text-primary">
                {formatTime(nextSweepMs)}
              </span>
            </div>
            <button
              onClick={triggerSweep}
              disabled={sweepRunning}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-devin-accent text-white text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sweepRunning ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sweeping…
                </>
              ) : (
                <>
                  <Play size={16} />
                  Sweep Now
                </>
              )}
            </button>
          </div>

          {/* Config info */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-devin-border">
            <div>
              <span className="text-[12px] text-devin-text-secondary uppercase tracking-wider">Schedule</span>
              <p className="text-[14px] text-devin-text-primary mt-1 font-mono">Weekdays at 9:00 AM</p>
            </div>
            <div>
              <span className="text-[12px] text-devin-text-secondary uppercase tracking-wider">Batch size</span>
              <p className="text-[14px] text-devin-text-primary mt-1 font-mono">3 issues per sweep</p>
            </div>
            <div>
              <span className="text-[12px] text-devin-text-secondary uppercase tracking-wider">Sort by</span>
              <p className="text-[14px] text-devin-text-primary mt-1 font-mono">due_date → priority → age</p>
            </div>
            <div>
              <span className="text-[12px] text-devin-text-secondary uppercase tracking-wider">Source</span>
              <p className="text-[14px] text-devin-text-primary mt-1 font-mono">Linear backlog (Tailored)</p>
            </div>
          </div>
        </div>

        {/* Sweep result */}
        {lastResult && (
          <div className="rounded-lg border border-devin-border p-6 mb-6">
            <h2 className="text-[14px] font-medium text-devin-text-primary mb-3">
              Sweep Result
            </h2>
            <div className="space-y-2 text-[13px]">
              {lastResult.processed.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-emerald-400">Triggered:</span>
                  <span className="text-devin-text-primary">{lastResult.processed.join(", ")}</span>
                </div>
              )}
              {lastResult.skipped.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-devin-text-secondary">Skipped:</span>
                  <span className="text-devin-text-primary">{lastResult.skipped.join(", ")}</span>
                </div>
              )}
              {lastResult.errors.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-red-400">Errors:</span>
                  <span className="text-devin-text-primary">
                    {lastResult.errors.map((e) => `${e.issueId}: ${e.error}`).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live activity log */}
        {(logs.length > 0 || logPolling) && (
          <div className="rounded-lg border border-devin-border bg-devin-bg-sidebar overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-devin-border">
              <Terminal size={14} className="text-devin-text-secondary" />
              <span className="text-[13px] font-medium text-devin-text-primary">Live Activity</span>
              {logPolling && (
                <span className="ml-auto flex items-center gap-1.5 text-[12px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Watching
                </span>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto p-1">
              {logs.length === 0 ? (
                <p className="text-[13px] text-devin-text-secondary px-3 py-4">Waiting for events…</p>
              ) : (
                logs.map((event) => {
                  const { text, color } = describeEvent(event);
                  return (
                    <div
                      key={event.event_id}
                      className="flex items-baseline gap-3 px-3 py-1.5 hover:bg-devin-hover rounded text-[13px]"
                    >
                      <span className="text-devin-text-secondary font-mono text-[12px] shrink-0">
                        {formatTimestamp(event.timestamp)}
                      </span>
                      <span className={color}>
                        {text}
                      </span>
                      {event.devin_session_url && (
                        <a
                          href={event.devin_session_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-devin-accent hover:text-devin-accent-bright text-[12px] shrink-0 ml-auto"
                        >
                          session ↗
                        </a>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
