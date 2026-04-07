import { z } from "zod";

export const FixStatusSchema = z.enum([
  "investigating",
  "implementing",
  "testing",
  "done",
  "blocked",
]);

export const FixProgressSchema = z.object({
  status: FixStatusSchema,
  files_changed: z.array(z.string()),
  tests_added: z.array(z.string()),
  lint_passing: z.boolean(),
  ci_attempt: z.number(),
  ci_passing: z.boolean(),
  pr_url: z.string().nullable(),
  video_url: z.string().nullable(),
  blocker_reason: z.string().nullable(),
});

export type FixProgress = z.infer<typeof FixProgressSchema>;

export const fixProgressJsonSchema = {
  type: "object" as const,
  properties: {
    status: {
      type: "string",
      enum: ["investigating", "implementing", "testing", "done", "blocked"],
    },
    files_changed: { type: "array", items: { type: "string" } },
    tests_added: { type: "array", items: { type: "string" } },
    lint_passing: { type: "boolean" },
    ci_attempt: { type: "number" },
    ci_passing: { type: "boolean" },
    pr_url: { type: ["string", "null"] },
    video_url: { type: ["string", "null"] },
    blocker_reason: { type: ["string", "null"] },
  },
  required: [
    "status",
    "files_changed",
    "tests_added",
    "lint_passing",
    "ci_attempt",
    "ci_passing",
  ],
};
