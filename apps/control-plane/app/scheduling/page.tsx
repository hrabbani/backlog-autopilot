"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, Clock, Loader2 } from "lucide-react";

const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:3001";

interface SweepResult {
  status: string;
  processed: string[];
  skipped: string[];
  errors: Array<{ issueId: string; error: string }>;
}

export default function SchedulingPage() {
  const [nextSweepMs, setNextSweepMs] = useState(SWEEP_INTERVAL_MS);
  const [sweepRunning, setSweepRunning] = useState(false);
  const [lastResult, setLastResult] = useState<SweepResult | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNextSweepMs((prev) => {
        if (prev <= 1000) return SWEEP_INTERVAL_MS;
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const triggerSweep = useCallback(async () => {
    setSweepRunning(true);
    setLastResult(null);
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/api/sweep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 4 }),
      });
      const data = (await res.json()) as SweepResult;
      setLastResult(data);
      setNextSweepMs(SWEEP_INTERVAL_MS);
    } catch (err) {
      setLastResult({
        status: "error",
        processed: [],
        skipped: [],
        errors: [{ issueId: "N/A", error: err instanceof Error ? err.message : "Failed to reach orchestrator" }],
      });
    } finally {
      setSweepRunning(false);
    }
  }, []);

  return (
    <div className="p-8">
      <div className="max-w-3xl">
        <h1 className="text-xl font-semibold text-devin-text-primary mb-1">
          Scheduling
        </h1>
        <p className="text-[13px] text-devin-text-secondary mb-8">
          Backlog sweep configuration and manual trigger.
        </p>

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

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-devin-border">
            <div>
              <span className="text-[12px] text-devin-text-secondary uppercase tracking-wider">Schedule</span>
              <p className="text-[14px] text-devin-text-primary mt-1 font-mono">Weekdays at 9:00 AM</p>
            </div>
            <div>
              <span className="text-[12px] text-devin-text-secondary uppercase tracking-wider">Batch size</span>
              <p className="text-[14px] text-devin-text-primary mt-1 font-mono">4 issues per sweep</p>
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

        {lastResult && (
          <div className="rounded-lg border border-devin-border p-6">
            <h2 className="text-[14px] font-medium text-devin-text-primary mb-3">
              Last Sweep Result
            </h2>
            <div className="space-y-2 text-[13px]">
              {lastResult.processed.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-green-400">Triggered:</span>
                  <span className="text-devin-text-primary">{lastResult.processed.join(", ")}</span>
                </div>
              )}
              {lastResult.skipped.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-devin-text-secondary">Skipped (already triaged):</span>
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
              {lastResult.processed.length === 0 && lastResult.errors.length === 0 && lastResult.skipped.length > 0 && (
                <p className="text-devin-text-secondary">All issues already triaged. Nothing new to process.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
