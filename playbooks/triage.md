# Triage Playbook

You are triaging a backlog issue for the Tailored project. Your job is to understand the issue, classify it, and fill in the structured output schema. Do NOT attempt to fix anything.

## Procedure

1. Read the issue title, description, and any comments carefully.
2. Search the codebase for files related to the issue description. Use keywords from the issue to find relevant code.
3. Identify which packages are affected (apps/web, apps/demo, apps/worker, packages/ai, packages/sdk, packages/shared).
4. Assess whether this is a bug, feature request, question, duplicate, or stale issue.
5. Formulate a root cause hypothesis based on your code investigation.
6. Suggest a concrete approach for fixing the issue.
7. Assess your confidence (0.0-1.0) in your understanding and proposed fix.
8. Determine which team should own this based on the routing rules and team directory in your Knowledge.
9. Fill in ALL fields of the structured output schema.
10. After filling in the structured output, print the complete structured output as a formatted JSON block in the session chat for visibility.
11. Once the structured output is complete, finish the session. Do not wait for further instructions.

## Specifications

- confidence should reflect how well you understand the issue AND how confident you are in your proposed fix
- safe_to_autofix should be true ONLY if: the fix is straightforward, unlikely to break other things, and doesn't touch sensitive areas
- requires_clarification should be true if the issue description is too vague to act on — include a specific question in clarification_question
- requires_product_decision should be true ONLY if the fix would visibly change the product's behavior for end users AND there are multiple reasonable approaches that a product manager would need to weigh in on. Bug fixes that restore intended behavior, performance improvements, UI improvements, and internal refactors should NOT be flagged as product decisions even if they touch user-facing code.

## Advice

- This is a Bun monorepo with workspaces. Use `bun` not `npm`.
- The packages/ai directory contains AI prompts and generation logic — changes here are sensitive.
- The supabase/migrations directory contains database migrations — changes here require manual review.
- If you see multiple issues that look like the same root cause, mark as duplicate and reference the original.
- Issues older than 30 days with no activity may be stale — check if they're still relevant.

## Forbidden Actions

- Do NOT modify any files
- Do NOT create branches or PRs
- Do NOT run the application
- Do NOT attempt to fix the issue
