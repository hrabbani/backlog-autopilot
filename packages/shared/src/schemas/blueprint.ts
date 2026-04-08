import { z } from "zod";

export const BlueprintSchema = z.object({
  version: z.number(),
  triage: z.object({
    auto_dispatch_threshold: z.object({
      max_complexity: z.enum(["small", "medium", "large"]),
      requires: z.array(z.string()),
    }),
  }),
  policy: z.object({
    blocked_paths: z.array(z.string()),
    blocked_labels: z.array(z.string()),
  }),
  notifications: z.object({
    team_channels: z.record(z.string()),
    pr_channels: z.record(z.string()),
    log_channel: z.string(),
  }),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;
