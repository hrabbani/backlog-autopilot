import { getDevinClient } from "./devin.js";
import { getDb } from "./db.js";

type SessionCallback = (session: {
  devin_session_id: string;
  session_type: string;
  issue_id: string;
  status: string;
  status_detail?: string;
  structured_output?: Record<string, unknown>;
  pull_requests?: Array<{ pr_url: string; pr_state: string }>;
}) => Promise<void>;

let pollInterval: ReturnType<typeof setInterval> | null = null;
let onSessionComplete: SessionCallback | null = null;
let onSessionUpdate: SessionCallback | null = null;
let isPolling = false;

export function startPoller(callbacks: {
  onComplete: SessionCallback;
  onUpdate?: SessionCallback;
  intervalMs?: number;
}): void {
  stopPoller(); // clear any existing interval first
  onSessionComplete = callbacks.onComplete;
  onSessionUpdate = callbacks.onUpdate ?? null;
  const interval = callbacks.intervalMs ?? 15_000; // 15 seconds

  console.log(
    `[poller] Starting session poller (every ${interval / 1000}s)`
  );

  pollInterval = setInterval(pollActiveSessions, interval);
  // Also run immediately
  pollActiveSessions();
}

export function stopPoller(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("[poller] Stopped");
  }
}

async function pollActiveSessions(): Promise<void> {
  if (isPolling) return;
  isPolling = true;
  try {
    await pollActiveSessionsInner();
  } finally {
    isPolling = false;
  }
}

async function pollActiveSessionsInner(): Promise<void> {
  const db = getDb();
  const activeSessions = db
    .prepare("SELECT * FROM active_sessions WHERE status = 'running'")
    .all() as Array<{
    devin_session_id: string;
    session_type: string;
    issue_id: string;
    status: string;
    structured_output: string | null;
  }>;

  if (activeSessions.length === 0) return;

  const devin = getDevinClient();

  for (const session of activeSessions) {
    try {
      const devinSession = await devin.getSession(session.devin_session_id);

      // Update structured output if changed
      const newOutput = devinSession.structured_output
        ? JSON.stringify(devinSession.structured_output)
        : null;

      if (newOutput !== session.structured_output) {
        db.prepare(
          "UPDATE active_sessions SET structured_output = @output WHERE devin_session_id = @id"
        ).run({ output: newOutput, id: session.devin_session_id });
      }

      // Check if session is terminal
      const terminalStatuses = ["exit", "error"];
      const terminalDetails = [
        "finished",
        "inactivity",
        "usage_limit_exceeded",
        "error",
      ];

      const isTerminal =
        terminalStatuses.includes(devinSession.status) ||
        (devinSession.status_detail &&
          terminalDetails.includes(devinSession.status_detail));

      if (isTerminal) {
        db.prepare(
          "UPDATE active_sessions SET status = @status WHERE devin_session_id = @id"
        ).run({ status: "completed", id: session.devin_session_id });

        console.log(
          `[poller] Session ${session.devin_session_id} completed (${devinSession.status}/${devinSession.status_detail})`
        );

        if (onSessionComplete) {
          await onSessionComplete({
            devin_session_id: session.devin_session_id,
            session_type: session.session_type,
            issue_id: session.issue_id,
            status: devinSession.status,
            status_detail: devinSession.status_detail,
            structured_output: devinSession.structured_output ?? undefined,
            pull_requests: devinSession.pull_requests ?? undefined,
          });
        }
      } else if (onSessionUpdate) {
        await onSessionUpdate({
          devin_session_id: session.devin_session_id,
          session_type: session.session_type,
          issue_id: session.issue_id,
          status: devinSession.status,
          status_detail: devinSession.status_detail,
          structured_output: devinSession.structured_output ?? undefined,
          pull_requests: devinSession.pull_requests ?? undefined,
        });
      }
    } catch (err) {
      console.error(
        `[poller] Error polling session ${session.devin_session_id}:`,
        err
      );
    }
  }
}

/**
 * Register a new session to be tracked by the poller.
 */
export function trackSession(params: {
  devin_session_id: string;
  session_type: "triage" | "job" | "clarification";
  issue_id: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO active_sessions
     (devin_session_id, session_type, issue_id, created_at, status)
     VALUES (@devin_session_id, @session_type, @issue_id, @created_at, 'running')`
  ).run({
    ...params,
    created_at: new Date().toISOString(),
  });

  console.log(
    `[poller] Tracking ${params.session_type} session ${params.devin_session_id} for issue ${params.issue_id}`
  );
}
