import type { Request, Response } from "express";
import { checkPolicyBlock } from "../triage.js";
import { logEvent } from "../ledger.js";
import { triggerTriage } from "../pipeline.js";

interface LinearWebhookPayload {
  action: string;
  type: string;
  data: {
    id: string;
    identifier: string;
    title: string;
    description?: string;
    url: string;
    priority: number;
    dueDate?: string;
    labels?: Array<{ name: string }>;
    state?: { name: string; type: string };
    team?: { name: string; key: string };
    assignee?: { name: string; email: string };
  };
}

export function handleLinearWebhook(req: Request, res: Response): void {
  const payload = req.body as LinearWebhookPayload;

  // Acknowledge immediately
  res.status(200).json({ received: true });

  try {
    processWebhook(payload);
  } catch (err) {
    console.error("[webhook] Error processing payload:", err);
  }
}

function processWebhook(payload: LinearWebhookPayload): void {
  // Only process issue events
  if (payload.type !== "Issue") {
    console.log(`[webhook] Ignoring non-issue event: ${payload.type}`);
    return;
  }

  // Only process create/update
  if (!["create", "update"].includes(payload.action)) {
    console.log(`[webhook] Ignoring action: ${payload.action}`);
    return;
  }

  const issue = payload.data;
  console.log(
    `[webhook] Received ${payload.action} for ${issue.identifier}: ${issue.title}`
  );

  // Check if issue is in a terminal state (done, cancelled)
  if (issue.state?.type === "completed" || issue.state?.type === "canceled") {
    console.log(`[webhook] Issue ${issue.identifier} is in terminal state, skipping`);
    return;
  }

  // Pre-pass: check policy blocks from labels
  const labels = issue.labels?.map((l) => l.name) ?? [];
  const policyBlock = checkPolicyBlock(labels);

  if (policyBlock) {
    console.log(
      `[webhook] Issue ${issue.identifier} policy-blocked by ${policyBlock}`
    );
    logEvent({
      issue_id: issue.identifier,
      issue_title: issue.title,
      action: "policy_blocked",
      path: "path_4_policy_block",
      confidence: null,
      routing_rule_applied: null,
      responsible_team: issue.team?.name ?? null,
      devin_session_id: null,
      devin_session_url: null,
      pr_url: null,
      metadata: { blocked_by: policyBlock, source: "webhook_prepass" },
    });

    // TODO: Post policy block triage brief to Slack
    // TODO: Update Linear ticket with policy block label
    return;
  }

  // Dispatch to triage pipeline
  console.log(`[webhook] Dispatching triage for ${issue.identifier}`);
  triggerTriage({
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    url: issue.url,
    priority: issue.priority,
    labels,
    dueDate: issue.dueDate,
  }).catch((err) => {
    console.error(`[webhook] Failed to trigger triage for ${issue.identifier}:`, err);
  });
}
