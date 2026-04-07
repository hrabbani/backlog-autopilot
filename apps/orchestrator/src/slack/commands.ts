import type { App } from "@slack/bolt";
import { getDigest, logEvent } from "../ledger.js";
import { getDb } from "../db.js";
import { dispatchJob } from "../pipeline.js";
import { postMessage, postWithThread, postLogMessage, getSlackApp } from "./app.js";
import { buildTriageMainBlocks, buildTriageDetailBlocks, buildLogOneLiner } from "./messages.js";
import { loadBlueprint } from "../config.js";
import { addLearnedPattern } from "../routing.js";
import { TriageOutputSchema } from "@backlog-autopilot/shared";

/**
 * Register all Slack command and action handlers.
 * Call this during app startup.
 */
export function registerSlackHandlers(app: App): void {
  // @BacklogAutopilot triage <issue>
  app.event("app_mention", async ({ event, say }) => {
    // Ignore threaded replies — those are handled by the message handler (e.g. clarification replies)
    if (event.thread_ts) return;

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
          "*Weekly Digest*",
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
  app.action("approve_fix", async ({ ack, body }) => {
    await ack();
    let payload: { issue_id: string };
    try {
      payload = JSON.parse((body as any).actions[0].value);
    } catch {
      return;
    }
    const userId = (body as any).user?.id ?? "unknown";
    const messageTs = (body as any).message?.ts as string | undefined;
    const channelId = (body as any).channel?.id as string | undefined;

    // Post approval confirmation as thread reply
    if (channelId && messageTs) {
      await postMessage({
        channel: channelId,
        text: `Approved by <@${userId}>. I'm dispatching a fix now...`,
        thread_ts: messageTs,
      });
    }

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

        const approvalThread = channelId && messageTs
          ? { channel: channelId, messageTs }
          : undefined;

        dispatchJob(
          payload.issue_id,
          parseResult.data,
          triageEvent.devin_session_url ?? "",
          approvalThread
        ).catch((err) => {
          console.error(`[slack] Failed to dispatch job for ${payload.issue_id}:`, err);
        });
      }
    }
  });

  // I'll Handle This button
  app.action("human_claim", async ({ ack, body }) => {
    await ack();
    let payload: { issue_id: string };
    try {
      payload = JSON.parse((body as any).actions[0].value);
    } catch {
      return;
    }
    const userId = (body as any).user?.id ?? "unknown";
    const messageTs = (body as any).message?.ts as string | undefined;
    const channelId = (body as any).channel?.id as string | undefined;

    if (channelId && messageTs) {
      await postMessage({
        channel: channelId,
        text: `<@${userId}> is taking this one. I'll stand down on ${payload.issue_id}.`,
        thread_ts: messageTs,
      });
    }

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
  app.action("edit_scope", async ({ ack, body }) => {
    await ack();
    let payload: { issue_id: string };
    try {
      payload = JSON.parse((body as any).actions[0].value);
    } catch {
      return;
    }
    const messageTs = (body as any).message?.ts as string | undefined;
    const channelId = (body as any).channel?.id as string | undefined;

    if (channelId && messageTs) {
      await postMessage({
        channel: channelId,
        text: `Reply in this thread to refine the scope for ${payload.issue_id}. I'll pick up your instructions.`,
        thread_ts: messageTs,
      });
    }
  });

  // No-op handlers for link buttons
  app.action("view_pr", async ({ ack }) => { await ack(); });
  app.action("view_session", async ({ ack }) => { await ack(); });

  // Correct Routing button — open modal
  app.action("correct_routing", async ({ ack, body }) => {
    await ack();
    let payload: { issue_id: string; issue_title: string };
    try {
      payload = JSON.parse((body as any).actions[0].value);
    } catch {
      return;
    }

    const slackApp = getSlackApp();
    await slackApp.client.views.open({
      trigger_id: (body as any).trigger_id,
      view: {
        type: "modal",
        callback_id: "correct_routing_submit",
        title: { type: "plain_text", text: "Correct Routing" },
        submit: { type: "plain_text", text: "Submit" },
        private_metadata: JSON.stringify({
          issue_id: payload.issue_id,
          issue_title: payload.issue_title,
          message_ts: (body as any).message?.ts,
          channel_id: (body as any).channel?.id,
        }),
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*${payload.issue_id}:* ${payload.issue_title}` },
          },
          {
            type: "input",
            block_id: "team_select",
            label: { type: "plain_text", text: "Correct team" },
            element: {
              type: "static_select",
              action_id: "team_value",
              placeholder: { type: "plain_text", text: "Select the correct team" },
              options: [
                { text: { type: "plain_text", text: "AI Team" }, value: "team-ai" },
                { text: { type: "plain_text", text: "Platform Team" }, value: "team-platform" },
                { text: { type: "plain_text", text: "Frontend Team" }, value: "team-frontend" },
                { text: { type: "plain_text", text: "SDK Team" }, value: "team-sdk" },
              ],
            },
          },
        ],
      },
    });
  });

  // Correct Routing modal submission
  app.view("correct_routing_submit", async ({ ack, body, view }) => {
    await ack();

    const meta = JSON.parse(view.private_metadata);
    const { issue_id, issue_title, message_ts, channel_id } = meta;
    const selectedTeam = (view.state as any).values.team_select.team_value.selected_option.value;
    const userId = body.user.id;

    // Look up original triage from ledger
    const triageEvent = getDb()
      .prepare(
        "SELECT metadata FROM ledger_events WHERE issue_id = @issueId AND action = 'triage_completed' ORDER BY timestamp DESC LIMIT 1"
      )
      .get({ issueId: issue_id }) as { metadata: string } | undefined;

    let originalTeam = "unknown";
    let triage: any = null;
    if (triageEvent?.metadata) {
      const metaData = JSON.parse(triageEvent.metadata);
      triage = metaData.triage_output;
      originalTeam = triage?.responsible_team ?? "unknown";
    }

    // Look up session URL
    const sessionEvent = getDb()
      .prepare(
        "SELECT devin_session_url FROM ledger_events WHERE issue_id = @issueId AND devin_session_url IS NOT NULL ORDER BY timestamp DESC LIMIT 1"
      )
      .get({ issueId: issue_id }) as { devin_session_url: string } | undefined;
    const sessionUrl = sessionEvent?.devin_session_url ?? "";

    // Skip if same team
    if (selectedTeam === originalTeam) {
      if (channel_id && message_ts) {
        await postMessage({
          channel: channel_id,
          text: "That's already the current routing.",
          thread_ts: message_ts,
        });
      }
      return;
    }

    // Update Devin Knowledge note
    await addLearnedPattern({
      issueTitle: issue_title,
      target_team: selectedTeam,
      corrected_from_team: originalTeam,
      learned_from_issue: issue_id,
      corrected_by: userId,
    });

    // Post confirmation as thread reply
    if (channel_id && message_ts) {
      await postMessage({
        channel: channel_id,
        text: `Routing corrected by <@${userId}>: moved from ${originalTeam} to ${selectedTeam}. I've updated my routing rules.`,
        thread_ts: message_ts,
      });
    }

    // Resend triage message to correct team channel
    const blueprint = loadBlueprint();
    const correctChannel = blueprint.notifications.team_channels[selectedTeam] ?? blueprint.notifications.log_channel;
    const issueUrl = `https://linear.app/tailored-sdk/issue/${issue_id}`;

    if (triage) {
      const parseResult = TriageOutputSchema.safeParse(triage);
      if (parseResult.success) {
        await postWithThread({
          channel: correctChannel,
          text: `Routing correction: ${issue_title}`,
          blocks: buildTriageMainBlocks({
            headline: "Routed from " + originalTeam,
            issueId: issue_id,
            issueTitle: issue_title,
            issueUrl,
            summary: `This was originally sent to ${originalTeam} but <@${userId}> corrected the routing. ${parseResult.data.root_cause_hypothesis.split('.')[0]}.`,
            buttons: true,
            correctRoutingButton: true,
          }),
          threadText: `Triage details for ${issue_id}`,
          threadBlocks: buildTriageDetailBlocks({
            triage: parseResult.data,
            sessionUrl,
          }),
        });
      }
    }

    // Log to updates channel
    await postLogMessage(
      blueprint.notifications.log_channel,
      buildLogOneLiner({
        issueId: issue_id,
        issueTitle: issue_title,
        issueUrl,
        action: "Routing corrected",
        detail: `moved from ${originalTeam} to ${selectedTeam} by <@${userId}>`,
      })
    );
  });

  // Clarification reply handler — listens for @mentions in clarification threads
  app.message(async ({ message, say }) => {
    // Only handle threaded messages that mention the bot
    const msg = message as any;
    if (!msg.thread_ts || msg.thread_ts === msg.ts) return; // not a thread reply
    if (!msg.text) return;
    if (msg.subtype) return; // ignore bot messages, edits, etc.

    // Check if our bot is mentioned
    const botUserId = process.env.SLACK_BOT_USER_ID;
    if (!botUserId) return;
    if (!msg.text.includes(`<@${botUserId}>`)) return;

    // Look up clarification events to find one matching this thread
    const db = getDb();
    const clarificationEvent = db
      .prepare(
        `SELECT issue_id, metadata, devin_session_url
         FROM ledger_events
         WHERE action = 'clarification_requested'
           AND json_extract(metadata, '$.message_ts') = @threadTs
         ORDER BY timestamp DESC LIMIT 1`
      )
      .get({ threadTs: msg.thread_ts }) as {
        issue_id: string;
        metadata: string;
        devin_session_url: string;
      } | undefined;

    if (!clarificationEvent) return; // not a clarification thread

    // Check if we already dispatched a job for this clarification (one-shot guard)
    const alreadyDispatched = db
      .prepare(
        `SELECT 1 FROM ledger_events
         WHERE issue_id = @issueId
           AND action = 'clarification_resolved'
         LIMIT 1`
      )
      .get({ issueId: clarificationEvent.issue_id });

    if (alreadyDispatched) {
      await say({
        text: "I already dispatched a fix for this issue based on earlier clarification.",
        thread_ts: msg.thread_ts,
      });
      return;
    }

    // Extract the clarification text (strip the bot mention)
    const clarificationText = msg.text
      .replace(new RegExp(`<@${botUserId}>`, "g"), "")
      .trim();

    if (!clarificationText) {
      await say({
        text: "I see the mention but no clarification text. Could you reply again with the details?",
        thread_ts: msg.thread_ts,
      });
      return;
    }

    // Look up the original triage output
    const triageEvent = db
      .prepare(
        `SELECT metadata, devin_session_url
         FROM ledger_events
         WHERE issue_id = @issueId
           AND action = 'triage_completed'
         ORDER BY timestamp DESC LIMIT 1`
      )
      .get({ issueId: clarificationEvent.issue_id }) as {
        metadata: string;
        devin_session_url: string;
      } | undefined;

    if (!triageEvent?.metadata) {
      await say({
        text: "I couldn't find the original triage for this issue. Something went wrong.",
        thread_ts: msg.thread_ts,
      });
      return;
    }

    const meta = JSON.parse(triageEvent.metadata);
    const parseResult = TriageOutputSchema.safeParse(meta.triage_output);
    if (!parseResult.success) {
      await say({
        text: "I couldn't parse the triage data for this issue.",
        thread_ts: msg.thread_ts,
      });
      return;
    }

    const triage = parseResult.data;
    const userId = msg.user as string;
    const channel = msg.channel as string;

    // Log clarification resolved
    logEvent({
      issue_id: clarificationEvent.issue_id,
      issue_title: "",
      action: "clarification_resolved",
      path: "path_3_clarification",
      confidence: triage.confidence,
      routing_rule_applied: null,
      responsible_team: triage.responsible_team,
      devin_session_id: null,
      devin_session_url: null,
      pr_url: null,
      metadata: {
        clarification_text: clarificationText,
        clarified_by: userId,
      },
    });

    // Dispatch job with clarification context
    await dispatchJob(
      clarificationEvent.issue_id,
      triage,
      triageEvent.devin_session_url ?? "",
      undefined, // no approval thread
      {
        text: clarificationText,
        userId,
        channel,
        messageTs: msg.thread_ts,
      }
    );

    // Log to updates channel
    const blueprint = loadBlueprint();
    const issueUrl = `https://linear.app/tailored-sdk/issue/${clarificationEvent.issue_id}`;
    await postLogMessage(
      blueprint.notifications.log_channel,
      buildLogOneLiner({
        issueId: clarificationEvent.issue_id,
        issueTitle: "",
        issueUrl,
        action: "Clarification received, auto-dispatched",
        detail: `context from <@${userId}>`,
      })
    );
  });
}
