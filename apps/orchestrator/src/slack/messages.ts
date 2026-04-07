import type { TriageOutput } from "@backlog-autopilot/shared";

export function buildTriageBriefBlocks(params: {
  issueId: string;
  issueTitle: string;
  issueUrl: string;
  triage: TriageOutput;
  sessionUrl: string;
}): Array<Record<string, unknown>> {
  const { issueId, issueTitle, issueUrl, triage, sessionUrl } = params;

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Triage Brief: ${issueId}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${issueUrl}|${issueTitle}>*\n\n*Category:* ${triage.issue_category} | *Confidence:* ${(triage.confidence * 100).toFixed(0)}% | *Complexity:* ${triage.complexity}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Root Cause Hypothesis:*\n${triage.root_cause_hypothesis}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Suggested Approach:*\n${triage.suggested_approach}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Affected Files:*\n${triage.affected_files.map((f) => `\`${f}\``).join(", ") || "none identified"}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Team:* ${triage.responsible_team} | *Due Date:* ${triage.due_date_status} | <${sessionUrl}|View Devin Session>`,
      },
    },
  ];
}

export function buildApprovalBlocks(params: {
  issueId: string;
  issueTitle: string;
  issueUrl: string;
  triage: TriageOutput;
  sessionUrl: string;
}): Array<Record<string, unknown>> {
  const briefBlocks = buildTriageBriefBlocks(params);

  return [
    ...briefBlocks,
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve Fix" },
          style: "primary",
          action_id: "approve_fix",
          value: JSON.stringify({
            issue_id: params.issueId,
          }),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Edit Scope" },
          action_id: "edit_scope",
          value: JSON.stringify({
            issue_id: params.issueId,
          }),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "I'll Handle This" },
          style: "danger",
          action_id: "human_claim",
          value: JSON.stringify({
            issue_id: params.issueId,
          }),
        },
      ],
    },
  ];
}

export function buildPRNotification(params: {
  issueId: string;
  issueTitle: string;
  prUrl: string;
  sessionUrl: string;
  confidence: number;
  filesChanged: string[];
  videoUrl?: string;
}): Array<Record<string, unknown>> {
  const { issueId, issueTitle, prUrl, sessionUrl, confidence, filesChanged, videoUrl } = params;

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Backlog Autopilot opened a PR for ${issueId}*\n<${prUrl}|${issueTitle}>\n\nConfidence: ${(confidence * 100).toFixed(0)}% | Files: ${filesChanged.length} changed`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View PR" },
          url: prUrl,
          action_id: "view_pr",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "View Devin Session" },
          url: sessionUrl,
          action_id: "view_session",
        },
      ],
    },
  ];

  if (videoUrl) {
    blocks.splice(1, 0, {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Video proof:* <${videoUrl}|Watch Devin test the fix>`,
      },
    });
  }

  return blocks;
}

export function buildLogOneLiner(params: {
  issueId: string;
  issueTitle?: string;
  issueUrl?: string;
  action: string;
  detail: string;
}): string {
  const issueLink = params.issueUrl
    ? `<${params.issueUrl}|${params.issueId}>`
    : params.issueId;
  const title = params.issueTitle ? ` — ${params.issueTitle}` : "";
  return `*${issueLink}*${title} · ${params.action}: ${params.detail}`;
}

export function buildPolicyBlockBlocks(params: {
  issueId: string;
  issueTitle: string;
  issueUrl: string;
  triage: TriageOutput;
  sessionUrl: string;
  blockedBy: string;
}): Array<Record<string, unknown>> {
  const briefBlocks = buildTriageBriefBlocks(params);

  return [
    ...briefBlocks,
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Policy Block:* This issue touches \`${params.blockedBy}\`. Per policy, it requires manual review. Devin's triage brief above should help with the investigation.`,
      },
    },
  ];
}
