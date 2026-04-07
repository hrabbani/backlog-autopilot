import type { App } from "@slack/bolt";
import { getDigest, logEvent } from "../ledger.js";
import { getDb } from "../db.js";
import { dispatchJob } from "../pipeline.js";
import { TriageOutputSchema } from "@backlog-autopilot/shared";

/**
 * Register all Slack command and action handlers.
 * Call this during app startup.
 */
export function registerSlackHandlers(app: App): void {
  // @BacklogAutopilot triage <issue>
  app.event("app_mention", async ({ event, say }) => {
    const text = event.text.toLowerCase();

    if (text.includes("triage")) {
      // Extract issue identifier (e.g., TAIL-42)
      const match = event.text.match(/triage\s+([A-Z]+-\d+)/i);
      if (!match) {
        await say({
          text: "Usage: `@BacklogAutopilot triage TAIL-42`",
          thread_ts: event.ts,
        });
        return;
      }

      const issueIdentifier = match[1];
      await say({
        text: `Starting triage for ${issueIdentifier}...`,
        thread_ts: event.ts,
      });

      // The actual triage will be triggered by the pipeline module
      // This just acknowledges the command
    } else if (text.includes("digest")) {
      const oneWeekAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();
      const digest = getDigest(oneWeekAgo);

      await say({
        text: [
          "*Backlog Autopilot — Weekly Digest*",
          `Issues triaged: ${digest.issues_triaged}`,
          `Fixes dispatched: ${digest.jobs_dispatched}`,
          `PRs created: ${digest.prs_created}`,
          `PRs merged: ${digest.prs_merged}`,
          `Human-claimed: ${digest.human_claimed}`,
          `Policy blocked: ${digest.policy_blocked}`,
          `Routing corrections: ${digest.routing_corrections}`,
        ].join("\n"),
        thread_ts: event.ts,
      });
    } else {
      await say({
        text: "Commands: `triage <ISSUE-ID>`, `digest`",
        thread_ts: event.ts,
      });
    }
  });

  // Approve Fix button
  app.action("approve_fix", async ({ ack, body, respond }) => {
    await ack();
    let payload: { issue_id: string };
    try {
      payload = JSON.parse((body as any).actions[0].value);
    } catch {
      await respond({ text: "Internal error: could not parse action payload." });
      return;
    }
    const userId = (body as any).user?.id ?? "unknown";

    await respond({
      text: `Approved by <@${userId}>. Dispatching job session for ${payload.issue_id}...`,
      replace_original: false,
    });

    // Look up triage output from ledger
    const triageEvent = getDb()
      .prepare(
        "SELECT metadata, devin_session_url FROM ledger_events WHERE issue_id = @issueId AND action = 'triage_completed' ORDER BY timestamp DESC LIMIT 1"
      )
      .get({ issueId: payload.issue_id }) as { metadata: string; devin_session_url: string } | undefined;

    if (triageEvent?.metadata) {
      const meta = JSON.parse(triageEvent.metadata);
      const parseResult = TriageOutputSchema.safeParse(meta.triage_output);
      if (parseResult.success) {
        logEvent({
          issue_id: payload.issue_id,
          issue_title: "",
          action: "approval_granted",
          path: "path_2_approval",
          confidence: parseResult.data.confidence,
          routing_rule_applied: null,
          responsible_team: parseResult.data.responsible_team,
          devin_session_id: null,
          devin_session_url: null,
          pr_url: null,
          metadata: { approved_by: userId },
        });

        dispatchJob(
          payload.issue_id,
          parseResult.data,
          triageEvent.devin_session_url ?? ""
        ).catch((err) => {
          console.error(`[slack] Failed to dispatch job for ${payload.issue_id}:`, err);
        });
      }
    }
  });

  // I'll Handle This button
  app.action("human_claim", async ({ ack, body, respond }) => {
    await ack();
    let payload: { issue_id: string };
    try {
      payload = JSON.parse((body as any).actions[0].value);
    } catch {
      await respond({ text: "Internal error: could not parse action payload." });
      return;
    }
    const userId = (body as any).user?.id ?? "unknown";

    await respond({
      text: `<@${userId}> is taking this one. Devin standing down on ${payload.issue_id}.`,
      replace_original: false,
    });

    logEvent({
      issue_id: payload.issue_id,
      issue_title: "",
      action: "human_claimed",
      path: "path_2_approval",
      confidence: null,
      routing_rule_applied: null,
      responsible_team: null,
      devin_session_id: null,
      devin_session_url: null,
      pr_url: null,
      metadata: { claimed_by: userId },
    });
  });

  // Edit Scope button
  app.action("edit_scope", async ({ ack, body, respond }) => {
    await ack();
    let payload: { issue_id: string };
    try {
      payload = JSON.parse((body as any).actions[0].value);
    } catch {
      await respond({ text: "Internal error: could not parse action payload." });
      return;
    }

    await respond({
      text: `Reply in this thread to refine the scope for ${payload.issue_id}. Devin will pick up your instructions.`,
      replace_original: false,
    });

  });

  // No-op handlers for link buttons
  app.action("view_pr", async ({ ack }) => { await ack(); });
  app.action("view_session", async ({ ack }) => { await ack(); });
}
