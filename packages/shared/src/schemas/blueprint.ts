import { z } from "zod";

export const BlueprintSchema = z.object({
  version: z.number(),
  intake: z.object({
    sources: z.array(
      z.object({
        type: z.enum(["linear_webhook", "scheduled_sweep"]),
        project: z.string().optional(),
        events: z.array(z.string()).optional(),
        cron: z.string().optional(),
        sort_by: z.array(z.string()).optional(),
      })
    ),
  }),
  triage: z.object({
    playbook_id: z.string(),
    knowledge_ids: z.array(z.string()),
    auto_dispatch_threshold: z.object({
      min_confidence: z.number(),
      max_complexity: z.enum(["small", "medium", "large"]),
      requires: z.array(z.string()),
    }),
    approval_threshold: z.object({
      min_confidence: z.number(),
    }),
    below_approval: z.object({
      action: z.enum(["clarify", "skip"]),
    }),
  }),
  policy: z.object({
    blocked_paths: z.array(z.string()),
    blocked_labels: z.array(z.string()),
  }),
  job: z.object({
    playbook_id: z.string(),
    max_ci_attempts: z.number(),
    evidence: z.object({
      ui_changes: z.string(),
      backend_changes: z.string(),
    }),
  }),
  notifications: z.object({
    team_channels: z.record(z.string()),
    log_channel: z.string(),
  }),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;
