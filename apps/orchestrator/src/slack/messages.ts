import type { TriageOutput } from "@backlog-autopilot/shared";

/**
 * Human-friendly labels for policy block reasons and other internal keys.
 */
export function humanize(key: string): string {
  const map: Record<string, string> = {
    requires_product_decision: "Requires a product decision",
    "label:compliance": "Tagged as compliance-sensitive",
    "label:auth": "Tagged as auth-sensitive",
    "label:billing": "Tagged as billing-sensitive",
  };

  if (map[key]) return map[key];

  if (key.startsWith("path:")) {
    const p = key.slice(5).replace("/*", "");
    return `Touches ${p}`;
  }

  if (key.startsWith("label:")) {
    return `Tagged as ${key.slice(6)}`;
  }

  return key.replace(/_/g, " ");
}

/**
 * Compact main message for triage results.
 * Used for approval, clarification, and policy block paths.
 * Buttons are only included for approval path.
 */
export function buildTriageMainBlocks(params: {
  headline: string;
  issueId: string;
  issueTitle: string;
  issueUrl: string;
  summary: string;
  buttons?: boolean;
  correctRoutingButton?: boolean;
}): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${params.headline}: <${params.issueUrl}|${params.issueTitle}>*\n${params.summary}`,
      },
    },
  ];

  if (params.buttons || params.correctRoutingButton) {
    const elements: Array<Record<string, unknown>> = [];

    if (params.buttons) {
      elements.push(
        {
          type: "button",
          text: { type: "plain_text", text: "Approve Fix" },
          style: "primary",
          action_id: "approve_fix",
          value: JSON.stringify({ issue_id: params.issueId }),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Edit Scope" },
          action_id: "edit_scope",
          value: JSON.stringify({ issue_id: params.issueId }),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "I'll Handle This" },
          style: "danger",
          action_id: "human_claim",
          value: JSON.stringify({ issue_id: params.issueId }),
        },
      );
    }

    elements.push({
      type: "button",
      text: { type: "plain_text", text: "Correct Routing" },
      action_id: "correct_routing",
      value: JSON.stringify({ issue_id: params.issueId, issue_title: params.issueTitle }),
    });

    blocks.push({ type: "actions", elements });
  }

  return blocks;
}

/**
 * Detailed triage info posted as a thread reply.
 */
export function buildTriageDetailBlocks(params: {
  triage: TriageOutput;
  sessionUrl: string;
}): Array<Record<string, unknown>> {
  const { triage, sessionUrl } = params;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Root cause hypothesis*\n${triage.root_cause_hypothesis}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Suggested approach*\n${triage.suggested_approach}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Affected files*\n${triage.affected_files.map((f) => `\`${f}\``).join(", ") || "none identified"}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Team:* ${triage.responsible_team} · *Complexity:* ${triage.complexity}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${sessionUrl}|View Devin session>`,
      },
    },
  ];
}

/**
 * PR notification for review channels.
 */
export function buildPRNotification(params: {
  issueId: string;
  issueTitle: string;
  issueUrl: string;
  prUrl: string;
  prTitle?: string;
  sessionUrl: string;
  filesChanged: number;
  linesAdded?: number;
  videoUrl?: string;
}): Array<Record<string, unknown>> {
  const { issueId, issueTitle, issueUrl, prUrl, prTitle, sessionUrl, filesChanged, linesAdded, videoUrl } = params;

  const stats = [
    `${filesChanged} files changed`,
    ...(linesAdded != null ? [`+${linesAdded} lines`] : []),
  ].join(" · ");

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${prUrl}|${prTitle ?? issueTitle}>*\nI opened a PR for <${issueUrl}|${issueId}> — could someone please stamp it?\n${stats}`,
      },
    },
  ];

  if (videoUrl) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `I recorded a verification: <${videoUrl}|Watch the fix in action>`,
      },
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "View PR" },
        style: "primary",
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
  });

  return blocks;
}

/**
 * One-liner for the log channel.
 */
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
