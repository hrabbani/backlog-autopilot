import { nanoid } from "nanoid";
import { getDb } from "./db.js";
import type { LedgerEvent } from "@backlog-autopilot/shared";

export function logEvent(
  event: Omit<LedgerEvent, "event_id" | "timestamp">
): LedgerEvent {
  const db = getDb();
  const fullEvent: LedgerEvent = {
    event_id: `evt_${nanoid(12)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };

  db.prepare(
    `INSERT INTO ledger_events (
      event_id, timestamp, issue_id, issue_title, action, path,
      confidence, routing_rule_applied, responsible_team,
      devin_session_id, devin_session_url, pr_url, metadata
    ) VALUES (
      @event_id, @timestamp, @issue_id, @issue_title, @action, @path,
      @confidence, @routing_rule_applied, @responsible_team,
      @devin_session_id, @devin_session_url, @pr_url, @metadata
    )`
  ).run({
    ...fullEvent,
    metadata: fullEvent.metadata ? JSON.stringify(fullEvent.metadata) : null,
  });

  return fullEvent;
}

export function getEvents(options?: {
  issueId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}): LedgerEvent[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (options?.issueId) {
    conditions.push("issue_id = @issueId");
    params.issueId = options.issueId;
  }
  if (options?.action) {
    conditions.push("action = @action");
    params.action = options.action;
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const rows = db
    .prepare(
      `SELECT * FROM ledger_events ${where}
       ORDER BY timestamp DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset }) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
  })) as LedgerEvent[];
}

export function getDigest(sinceDate: string): {
  total_events: number;
  issues_triaged: number;
  jobs_dispatched: number;
  prs_created: number;
  prs_merged: number;
  human_claimed: number;
  policy_blocked: number;
  routing_corrections: number;
} {
  const db = getDb();

  const countAction = (action: string): number => {
    const row = db
      .prepare(
        `SELECT COUNT(*) as count FROM ledger_events
         WHERE action = @action AND timestamp >= @since`
      )
      .get({ action, since: sinceDate }) as { count: number };
    return row.count;
  };

  return {
    total_events:
      countAction("triage_completed") + countAction("policy_blocked"),
    issues_triaged: countAction("triage_completed"),
    jobs_dispatched:
      countAction("auto_dispatched") + countAction("approval_granted"),
    prs_created: countAction("pr_created"),
    prs_merged: countAction("pr_merged"),
    human_claimed: countAction("human_claimed"),
    policy_blocked: countAction("policy_blocked"),
    routing_corrections: countAction("routing_corrected"),
  };
}
