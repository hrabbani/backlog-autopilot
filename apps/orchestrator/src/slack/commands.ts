import type { App } from "@slack/bolt";
import { getDigest } from "../ledger.js";

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
