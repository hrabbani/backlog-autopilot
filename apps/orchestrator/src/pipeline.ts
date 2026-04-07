import { getDevinClient } from "./devin.js";
import { getDb } from "./db.js";
import { logEvent } from "./ledger.js";
import { makeDecision, checkPolicyBlock, type TriageDecision } from "./triage.js";
import { loadBlueprint } from "./config.js";
import { trackSession } from "./poller.js";
import { postMessage, postLogMessage, postWithThread } from "./slack/app.js";
import {
  buildTriageMainBlocks,
  buildTriageDetailBlocks,
  buildPRNotification,
  buildLogOneLiner,
  humanize,
} from "./slack/messages.js";
import {
  triageJsonSchema,
  TriageOutputSchema,
  type TriageOutput,
} from "@backlog-autopilot/shared";

/**
 * Look up issue title from the ledger (from the triage_started event).
 */
function getIssueInfo(issueId: string): { title: string; url: string } {
  const row = getDb()
    .prepare(
      "SELECT issue_title FROM ledger_events WHERE issue_id = @issueId AND action = 'triage_started' ORDER BY timestamp DESC LIMIT 1"
    )
    .get({ issueId }) as { issue_title: string } | undefined;
  // Construct Linear URL from identifier (e.g., TAI-5 → https://linear.app/.../TAI-5)
  const url = `https://linear.app/tailored-sdk/issue/${issueId}`;
  return { title: row?.issue_title ?? "", url };
}

/**
 * Trigger triage for a Linear issue.
 */
export async function triggerTriage(issue: {
  identifier: string;
  title: string;
  description?: string;
  url: string;
  priority: number;
  labels: string[];
  dueDate?: string;
}): Promise<void> {
  const blueprint = loadBlueprint();
  const db = getDb();

  // Pre-pass: policy block check from labels
  const policyBlock = checkPolicyBlock(issue.labels);
  if (policyBlock) {
    logEvent({
      issue_id: issue.identifier,
      issue_title: issue.title,
      action: "policy_blocked",
      path: "path_4_policy_block",
      confidence: null,
      routing_rule_applied: null,
      responsible_team: null,
      devin_session_id: null,
      devin_session_url: null,
      pr_url: null,
      metadata: { blocked_by: policyBlock, source: "label_prepass" },
    });

    await postLogMessage(
      blueprint.notifications.log_channel,
      buildLogOneLiner({
        issueId: issue.identifier,
        issueTitle: issue.title,
        issueUrl: issue.url,
        action: "Policy blocked",
        detail: humanize(policyBlock),
      })
    );
    return;
  }

  // Get stored config
  const triagePlaybookId = (
    db
      .prepare("SELECT value FROM config_store WHERE key = 'triage_playbook_id'")
      .get() as { value: string } | undefined
  )?.value;
  const routingNoteId = (
    db
      .prepare("SELECT value FROM config_store WHERE key = 'routing_rules_note_id'")
      .get() as { value: string } | undefined
  )?.value;
  const teamNoteId = (
    db
      .prepare("SELECT value FROM config_store WHERE key = 'team_directory_note_id'")
      .get() as { value: string } | undefined
  )?.value;

  if (!triagePlaybookId || !routingNoteId || !teamNoteId) {
    console.error("[pipeline] Missing config. Run setup first.");
    return;
  }

  // Create triage session
  const devin = getDevinClient();
  const session = await devin.createSession({
    prompt: `Triage this Linear issue:\n\nTitle: ${issue.title}\nIdentifier: ${issue.identifier}\nDescription: ${issue.description ?? "No description"}\nPriority: ${issue.priority}\nLabels: ${issue.labels.join(", ") || "none"}\nDue date: ${issue.dueDate ?? "none"}\n\nFill in the structured output schema completely.`,
    playbook_id: triagePlaybookId,
    knowledge_ids: [routingNoteId, teamNoteId],
    structured_output_schema: triageJsonSchema,
    tags: ["triage", issue.identifier],
    repos: ["hrabbani/tailored"],
    session_links: [issue.url],
  });

  trackSession({
    devin_session_id: session.session_id,
    session_type: "triage",
    issue_id: issue.identifier,
  });

  logEvent({
    issue_id: issue.identifier,
    issue_title: issue.title,
    action: "triage_started",
    path: null,
    confidence: null,
    routing_rule_applied: null,
    responsible_team: null,
    devin_session_id: session.session_id,
    devin_session_url: session.url,
    pr_url: null,
    metadata: null,
  });

  await postLogMessage(
    blueprint.notifications.log_channel,
    buildLogOneLiner({
      issueId: issue.identifier,
      issueTitle: issue.title,
      issueUrl: issue.url,
      action: "I started triaging",
      detail: `<${session.url}|View session>`,
    })
  );

  console.log(
    `[pipeline] Triage session created for ${issue.identifier}: ${session.session_id}`
  );
}

/**
 * Handle completed triage session — run decision gate and dispatch.
 */
export async function handleTriageComplete(params: {
  devin_session_id: string;
  issue_id: string;
  structured_output?: Record<string, unknown>;
}): Promise<void> {
  const { devin_session_id, issue_id, structured_output } = params;
  const blueprint = loadBlueprint();

  if (!structured_output) {
    console.error(`[pipeline] No structured output for triage session ${devin_session_id}`);
    return;
  }

  // Parse and validate triage output
  const parseResult = TriageOutputSchema.safeParse(structured_output);
  if (!parseResult.success) {
    console.error(`[pipeline] Invalid triage output:`, parseResult.error);
    return;
  }

  const triage = parseResult.data;
  const devin = getDevinClient();
  const session = await devin.getSession(devin_session_id);
  const issueInfo = getIssueInfo(issue_id);

  logEvent({
    issue_id,
    issue_title: "",
    action: "triage_completed",
    path: null,
    confidence: triage.confidence,
    routing_rule_applied: null,
    responsible_team: triage.responsible_team,
    devin_session_id,
    devin_session_url: session.url,
    pr_url: null,
    metadata: { triage_output: triage },
  });

  // Decision gate
  const decision = makeDecision(triage);
  console.log(`[pipeline] Decision for ${issue_id}: ${decision.path} — ${decision.reason}`);

  const teamChannel =
    blueprint.notifications.team_channels[triage.responsible_team] ??
    blueprint.notifications.log_channel;

  switch (decision.path) {
    case "path_1_autofix":
      logEvent({
        issue_id,
        issue_title: "",
        action: "auto_dispatched",
        path: "path_1_autofix",
        confidence: triage.confidence,
        routing_rule_applied: null,
        responsible_team: triage.responsible_team,
        devin_session_id: null,
        devin_session_url: null,
        pr_url: null,
        metadata: { reason: decision.reason },
      });
      await dispatchJob(issue_id, triage, session.url);
      break;

    case "path_2_approval": {
      const mainTs = await postWithThread({
        channel: teamChannel,
        text: `Approval needed: ${issueInfo.title}`,
        blocks: buildTriageMainBlocks({
          headline: "Approval needed",
          issueId: issue_id,
          issueTitle: issueInfo.title,
          issueUrl: issueInfo.url,
          summary: `I triaged this ${triage.complexity} ${triage.issue_category}. ${triage.root_cause_hypothesis.split('.')[0]}.`,
          buttons: true,
        }),
        threadText: `Triage details for ${issue_id}`,
        threadBlocks: buildTriageDetailBlocks({
          triage,
          sessionUrl: session.url,
        }),
      });

      logEvent({
        issue_id,
        issue_title: issueInfo.title,
        action: "approval_requested",
        path: "path_2_approval",
        confidence: triage.confidence,
        routing_rule_applied: null,
        responsible_team: triage.responsible_team,
        devin_session_id: devin_session_id,
        devin_session_url: session.url,
        pr_url: null,
        metadata: { reason: decision.reason, message_ts: mainTs, channel: teamChannel },
      });

      await postLogMessage(
        blueprint.notifications.log_channel,
        buildLogOneLiner({
          issueId: issue_id,
          issueTitle: issueInfo.title,
          issueUrl: issueInfo.url,
          action: "Awaiting approval",
          detail: `in ${teamChannel}`,
        })
      );
      break;
    }

    case "path_3_clarification": {
      const clarificationTs = await postWithThread({
        channel: teamChannel,
        text: `Clarification needed: ${issueInfo.title}`,
        blocks: buildTriageMainBlocks({
          headline: "Clarification needed",
          issueId: issue_id,
          issueTitle: issueInfo.title,
          issueUrl: issueInfo.url,
          summary: triage.clarification_question ?? "I need more information before I can act on this issue.",
          correctRoutingButton: true,
        }),
        threadText: `Triage details for ${issue_id}`,
        threadBlocks: buildTriageDetailBlocks({
          triage,
          sessionUrl: session.url,
        }),
      });

      logEvent({
        issue_id,
        issue_title: issueInfo.title,
        action: "clarification_requested",
        path: "path_3_clarification",
        confidence: triage.confidence,
        routing_rule_applied: null,
        responsible_team: triage.responsible_team,
        devin_session_id: devin_session_id,
        devin_session_url: session.url,
        pr_url: null,
        metadata: {
          reason: decision.reason,
          question: triage.clarification_question,
          message_ts: clarificationTs,
          channel: teamChannel,
        },
      });

      await postLogMessage(
        blueprint.notifications.log_channel,
        buildLogOneLiner({
          issueId: issue_id,
          issueTitle: issueInfo.title,
          issueUrl: issueInfo.url,
          action: "Clarification needed",
          detail: triage.clarification_question ?? "needs more info",
        })
      );
      break;
    }

    case "path_4_policy_block": {
      const blockedBy = (decision as Extract<TriageDecision, { path: "path_4_policy_block" }>).blocked_by;

      logEvent({
        issue_id,
        issue_title: issueInfo.title,
        action: "policy_blocked",
        path: "path_4_policy_block",
        confidence: triage.confidence,
        routing_rule_applied: null,
        responsible_team: triage.responsible_team,
        devin_session_id: devin_session_id,
        devin_session_url: session.url,
        pr_url: null,
        metadata: {
          blocked_by: blockedBy,
          source: "triage_output",
        },
      });

      await postWithThread({
        channel: teamChannel,
        text: `Manual handoff needed: ${issueInfo.title}`,
        blocks: buildTriageMainBlocks({
          headline: "Manual handoff needed",
          issueId: issue_id,
          issueTitle: issueInfo.title,
          issueUrl: issueInfo.url,
          summary: `${humanize(blockedBy)}. I've provided a triage brief in the thread to help with investigation.`,
          overrideButton: true,
          claimButton: true,
          correctRoutingButton: true,
        }),
        threadText: `Triage details for ${issue_id}`,
        threadBlocks: buildTriageDetailBlocks({
          triage,
          sessionUrl: session.url,
        }),
      });

      await postLogMessage(
        blueprint.notifications.log_channel,
        buildLogOneLiner({
          issueId: issue_id,
          issueTitle: issueInfo.title,
          issueUrl: issueInfo.url,
          action: "Flagged for manual handoff",
          detail: humanize(blockedBy),
        })
      );
      break;
    }
  }
}

/**
 * Dispatch a job session for an issue.
 */
export async function dispatchJob(
  issueId: string,
  triage: TriageOutput,
  triageSessionUrl: string,
  approvalThread?: { channel: string; messageTs: string },
  clarificationContext?: { text: string; userId: string; channel: string; messageTs: string }
): Promise<void> {
  const db = getDb();
  const jobPlaybookId = (
    db
      .prepare("SELECT value FROM config_store WHERE key = 'job_playbook_id'")
      .get() as { value: string } | undefined
  )?.value;

  if (!jobPlaybookId) {
    console.error("[pipeline] Missing job playbook ID");
    return;
  }

  let prompt = `Fix this issue:\n\nIdentifier: ${issueId}\nRoot cause: ${triage.root_cause_hypothesis}\nSuggested approach: ${triage.suggested_approach}\nAffected files: ${triage.affected_files.join(", ")}\nAffected packages: ${triage.affected_packages.join(", ")}`;

  if (clarificationContext) {
    prompt += `\n\nAdditional context from the team:\n${clarificationContext.text}`;
  }

  prompt += `\n\nIMPORTANT: Name your branch "${issueId.toLowerCase()}-fix" so Linear auto-links the PR.\n\nAfter creating the PR, test your changes and record a video. Include the video in the PR description.`;

  const devin = getDevinClient();
  const session = await devin.createSession({
    prompt,
    playbook_id: jobPlaybookId,
    tags: ["job", issueId],
    repos: ["hrabbani/tailored"],
    session_links: [triageSessionUrl],
  });

  trackSession({
    devin_session_id: session.session_id,
    session_type: "job",
    issue_id: issueId,
  });

  // Post session link to the originating thread (approval or clarification)
  const replyThread = approvalThread ?? (clarificationContext ? { channel: clarificationContext.channel, messageTs: clarificationContext.messageTs } : undefined);
  if (replyThread) {
    const replyText = clarificationContext
      ? `Got it — I'm incorporating <@${clarificationContext.userId}>'s input and dispatching a fix. Follow along: ${session.url}`
      : `I'm on it — follow along: ${session.url}`;

    await postMessage({
      channel: replyThread.channel,
      text: replyText,
      thread_ts: replyThread.messageTs,
    });
  }

  const issueInfo = getIssueInfo(issueId);

  logEvent({
    issue_id: issueId,
    issue_title: issueInfo.title,
    action: "job_started",
    path: "path_1_autofix",
    confidence: triage.confidence,
    routing_rule_applied: null,
    responsible_team: triage.responsible_team,
    devin_session_id: session.session_id,
    devin_session_url: session.url,
    pr_url: null,
    metadata: null,
  });

  // Notify team channel that a fix is in progress
  const blueprint = loadBlueprint();
  const teamChannel =
    blueprint.notifications.team_channels[triage.responsible_team] ??
    blueprint.notifications.log_channel;

  await postMessage({
    channel: teamChannel,
    text: `I'm working on a fix for ${issueId}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*I'm working on a fix for <${issueInfo.url}|${issueId}>*${issueInfo.title ? ` — ${issueInfo.title}` : ""}\n\nComplexity: ${triage.complexity}\n<${session.url}|Follow along as I work on this>`,
        },
      },
    ],
  });

  await postLogMessage(
    blueprint.notifications.log_channel,
    buildLogOneLiner({
      issueId,
      issueTitle: issueInfo.title,
      issueUrl: issueInfo.url,
      action: clarificationContext
        ? `Clarification from <@${clarificationContext.userId}> received, dispatching fix`
        : "I started working on a fix",
      detail: `<${session.url}|View session>`,
    })
  );

  console.log(
    `[pipeline] Fix session created for ${issueId}: ${session.session_id}`
  );
}

/**
 * Handle completed job session — notify and update.
 */
export async function handleJobComplete(params: {
  devin_session_id: string;
  issue_id: string;
  structured_output?: Record<string, unknown>;
  pull_requests?: Array<{ pr_url: string; pr_state: string }>;
}): Promise<void> {
  const blueprint = loadBlueprint();
  const devin = getDevinClient();
  const session = await devin.getSession(params.devin_session_id);

  const prUrl = params.pull_requests?.[0]?.pr_url ?? null;

  logEvent({
    issue_id: params.issue_id,
    issue_title: "",
    action: prUrl ? "pr_created" : "job_completed",
    path: "path_1_autofix",
    confidence: null,
    routing_rule_applied: null,
    responsible_team: null,
    devin_session_id: params.devin_session_id,
    devin_session_url: session.url,
    pr_url: prUrl,
    metadata: { structured_output: params.structured_output },
  });

  if (prUrl) {
    // Get team channel from the triage output stored in ledger
    const triageEvent = getDb()
      .prepare(
        "SELECT metadata FROM ledger_events WHERE issue_id = @issueId AND action = 'triage_completed' ORDER BY timestamp DESC LIMIT 1"
      )
      .get({ issueId: params.issue_id }) as { metadata: string } | undefined;

    let prChannel = blueprint.notifications.log_channel;
    let triageOutput: TriageOutput | undefined;
    if (triageEvent?.metadata) {
      const meta = JSON.parse(triageEvent.metadata);
      triageOutput = meta.triage_output;
      const team = triageOutput?.responsible_team;
      if (team && blueprint.notifications.pr_channels[team]) {
        prChannel = blueprint.notifications.pr_channels[team];
      }
    }

    // Check for video attachment
    let videoUrl: string | undefined;
    try {
      const attachments = await devin.getSessionAttachments(
        params.devin_session_id
      );
      const video = attachments.find(
        (a) =>
          a.name.endsWith(".mp4") ||
          a.name.endsWith(".webm") ||
          a.name.includes("recording")
      );
      videoUrl = video?.url;
    } catch {
      // Attachments may not be available
    }

    // Fetch PR metadata from GitHub API
    let prTitle: string | undefined;
    let linesAdded: number | undefined;
    let filesChanged = 0;

    const prMatch = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (prMatch) {
      const [, owner, repo, prNumber] = prMatch;
      try {
        const ghRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
          {
            headers: {
              ...(process.env.GITHUB_TOKEN
                ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                : {}),
              Accept: "application/vnd.github.v3+json",
            },
          }
        );
        if (ghRes.ok) {
          const prData = (await ghRes.json()) as {
            title: string;
            additions: number;
            changed_files: number;
          };
          prTitle = prData.title;
          linesAdded = prData.additions;
          filesChanged = prData.changed_files;
        }
      } catch {
        // Fall back to triage data
      }
    }

    // Fall back to triage affected files count
    if (filesChanged === 0) {
      filesChanged = triageOutput?.affected_files?.length ?? 0;
    }

    await postMessage({
      channel: prChannel,
      text: `PR ready for review: ${params.issue_id}`,
      blocks: buildPRNotification({
        issueId: params.issue_id,
        issueTitle: triageOutput?.root_cause_hypothesis ?? params.issue_id,
        issueUrl: getIssueInfo(params.issue_id).url,
        prUrl,
        prTitle,
        sessionUrl: session.url,
        filesChanged,
        linesAdded,
        videoUrl,
      }),
    });

    await postLogMessage(
      blueprint.notifications.log_channel,
      buildLogOneLiner({
        issueId: params.issue_id,
        issueTitle: getIssueInfo(params.issue_id).title,
        issueUrl: getIssueInfo(params.issue_id).url,
        action: "I opened a PR",
        detail: `<${prUrl}|View PR>, review in ${prChannel}`,
      })
    );
  }
}
