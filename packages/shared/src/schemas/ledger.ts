import { z } from "zod";

export const PipelinePathSchema = z.enum([
  "path_1_autofix",
  "path_2_approval",
  "path_3_clarification",
  "path_4_policy_block",
]);

export const LedgerActionSchema = z.enum([
  "triage_started",
  "triage_completed",
  "auto_dispatched",
  "approval_requested",
  "approval_granted",
  "approval_declined",
  "human_claimed",
  "clarification_requested",
  "clarification_resolved",
  "policy_blocked",
  "job_started",
  "job_completed",
  "job_failed",
  "pr_created",
  "pr_merged",
  "routing_corrected",
]);

export const LedgerEventSchema = z.object({
  event_id: z.string(),
  timestamp: z.string(),
  issue_id: z.string(),
  issue_title: z.string(),
  action: LedgerActionSchema,
  path: PipelinePathSchema.nullable(),
  confidence: z.number().nullable(),
  routing_rule_applied: z.string().nullable(),
  responsible_team: z.string().nullable(),
  devin_session_id: z.string().nullable(),
  devin_session_url: z.string().nullable(),
  pr_url: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
});

export type LedgerEvent = z.infer<typeof LedgerEventSchema>;
