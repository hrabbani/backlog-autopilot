import { loadBlueprint } from "./config.js";
import type { TriageOutput } from "@backlog-autopilot/shared";

export type TriageDecision =
  | { path: "path_1_autofix"; reason: string }
  | { path: "path_2_approval"; reason: string }
  | { path: "path_3_clarification"; reason: string }
  | { path: "path_4_policy_block"; reason: string; blocked_by: string };

/**
 * Deterministic pre-pass: check policy blocks before Devin triage.
 * Returns the blocking reason if blocked, null otherwise.
 */
export function checkPolicyBlock(
  issueLabels: string[],
  affectedPaths?: string[]
): string | null {
  const blueprint = loadBlueprint();

  // Check blocked labels
  for (const label of issueLabels) {
    if (
      blueprint.policy.blocked_labels.some(
        (bl) => bl.toLowerCase() === label.toLowerCase()
      )
    ) {
      return `label:${label}`;
    }
  }

  // Check blocked paths (if we have affected paths from triage)
  if (affectedPaths) {
    for (const filePath of affectedPaths) {
      for (const blockedPattern of blueprint.policy.blocked_paths) {
        if (matchGlob(filePath, blockedPattern)) {
          return `path:${blockedPattern}`;
        }
      }
    }
  }

  return null;
}

/**
 * Decision gate: given triage output, determine which pipeline path to take.
 */
export function makeDecision(triage: TriageOutput): TriageDecision {
  const blueprint = loadBlueprint();

  // Check policy blocks from triage output
  const policyBlock = checkPolicyBlock([], triage.affected_files);
  if (policyBlock) {
    return {
      path: "path_4_policy_block",
      reason: `Policy block: ${policyBlock}`,
      blocked_by: policyBlock,
    };
  }

  // Check if product decision required
  if (triage.requires_product_decision) {
    return {
      path: "path_4_policy_block",
      reason: "Requires product decision",
      blocked_by: "requires_product_decision",
    };
  }

  // Check if clarification needed
  if (triage.requires_clarification) {
    return {
      path: "path_3_clarification",
      reason: `Clarification needed: ${triage.clarification_question}`,
    };
  }

  // Check confidence thresholds
  const { auto_dispatch_threshold, approval_threshold } = blueprint.triage;

  if (triage.confidence < approval_threshold.min_confidence) {
    return {
      path: "path_3_clarification",
      reason: `Confidence too low (${triage.confidence} < ${approval_threshold.min_confidence})`,
    };
  }

  // Check auto-dispatch eligibility
  const complexityOrder = { small: 0, medium: 1, large: 2 };
  const maxComplexity =
    complexityOrder[auto_dispatch_threshold.max_complexity];
  const issueComplexity = complexityOrder[triage.complexity];

  const meetsConfidence =
    triage.confidence >= auto_dispatch_threshold.min_confidence;
  const meetsComplexity = issueComplexity <= maxComplexity;
  const meetsRequirements = auto_dispatch_threshold.requires.every((req) => {
    if (req.startsWith("!")) {
      const field = req.slice(1) as keyof TriageOutput;
      return !triage[field];
    }
    const field = req as keyof TriageOutput;
    return !!triage[field];
  });
  const isBug = triage.issue_category === "bug";

  if (meetsConfidence && meetsComplexity && meetsRequirements && isBug) {
    return {
      path: "path_1_autofix",
      reason: `Auto-dispatch: confidence=${triage.confidence}, complexity=${triage.complexity}, safe_to_autofix=${triage.safe_to_autofix}`,
    };
  }

  // Default: approval required
  return {
    path: "path_2_approval",
    reason: `Approval needed: confidence=${triage.confidence}, complexity=${triage.complexity}, category=${triage.issue_category}`,
  };
}

/**
 * Simple glob matching for policy paths.
 * Supports trailing /* for directory matching.
 */
function matchGlob(filePath: string, pattern: string): boolean {
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    return filePath.startsWith(prefix);
  }
  return filePath === pattern;
}
