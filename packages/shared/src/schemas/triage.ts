import { z } from "zod";

export const IssueCategorySchema = z.enum([
  "bug",
  "feature_request",
  "question",
  "duplicate",
  "stale",
]);

export const ComplexitySchema = z.enum(["small", "medium", "large"]);

export const DueDateStatusSchema = z.enum([
  "overdue",
  "approaching",
  "on_track",
  "no_due_date",
]);

export const TriageOutputSchema = z.object({
  issue_category: IssueCategorySchema,
  confidence: z.number().min(0).max(1),
  complexity: ComplexitySchema,
  affected_packages: z.array(z.string()),
  affected_files: z.array(z.string()),
  root_cause_hypothesis: z.string(),
  duplicate_of: z.string().nullable(),
  suggested_approach: z.string(),
  requires_clarification: z.boolean(),
  clarification_question: z.string().nullable(),
  requires_product_decision: z.boolean(),
  safe_to_autofix: z.boolean(),
  responsible_team: z.string(),
  due_date_status: DueDateStatusSchema,
});

export type TriageOutput = z.infer<typeof TriageOutputSchema>;

// JSON Schema version for Devin's structured_output_schema field
export const triageJsonSchema = {
  type: "object" as const,
  properties: {
    issue_category: {
      type: "string",
      enum: ["bug", "feature_request", "question", "duplicate", "stale"],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    complexity: { type: "string", enum: ["small", "medium", "large"] },
    affected_packages: { type: "array", items: { type: "string" } },
    affected_files: { type: "array", items: { type: "string" } },
    root_cause_hypothesis: { type: "string" },
    duplicate_of: { type: ["string", "null"] },
    suggested_approach: { type: "string" },
    requires_clarification: { type: "boolean" },
    clarification_question: { type: ["string", "null"] },
    requires_product_decision: { type: "boolean" },
    safe_to_autofix: { type: "boolean" },
    responsible_team: { type: "string" },
    due_date_status: {
      type: "string",
      enum: ["overdue", "approaching", "on_track", "no_due_date"],
    },
  },
  required: [
    "issue_category",
    "confidence",
    "complexity",
    "affected_packages",
    "affected_files",
    "root_cause_hypothesis",
    "suggested_approach",
    "requires_clarification",
    "requires_product_decision",
    "safe_to_autofix",
    "responsible_team",
    "due_date_status",
  ],
};
