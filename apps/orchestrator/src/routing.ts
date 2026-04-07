import { getDevinClient } from "./devin.js";
import { getDb } from "./db.js";
import { logEvent } from "./ledger.js";

/**
 * Get the Knowledge note ID for routing rules from the config store.
 */
function getRoutingNoteId(): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM config_store WHERE key = 'routing_rules_note_id'")
    .get() as { value: string } | undefined;
  return row?.value ?? null;
}

/**
 * Read the current routing rules from the Devin Knowledge note.
 */
export async function readRoutingRules(): Promise<string> {
  const noteId = getRoutingNoteId();
  if (!noteId) {
    console.warn("[routing] No routing rules Knowledge note ID stored. Run setup first.");
    return "";
  }

  const devin = getDevinClient();
  const note = await devin.getKnowledgeNote(noteId);
  return note.body;
}

/**
 * Append a learned pattern to the routing rules Knowledge note.
 * Called when an engineer corrects a routing decision via Slack (team dropdown).
 */
export async function addLearnedPattern(params: {
  issueTitle: string;
  target_team: string;
  corrected_from_team: string;
  learned_from_issue: string;
  corrected_by: string;
}): Promise<void> {
  const { issueTitle, target_team, corrected_from_team, learned_from_issue, corrected_by } = params;

  const noteId = getRoutingNoteId();
  if (!noteId) {
    console.warn("[routing] No routing rules Knowledge note ID stored. Run setup first.");
    return;
  }

  const devin = getDevinClient();

  // Read current rules from Knowledge
  const note = await devin.getKnowledgeNote(noteId);
  let rules = note.body;

  // Ensure Learned Patterns section exists
  const learnedSection = "## Learned Patterns";
  if (!rules.includes(learnedSection)) {
    rules += `\n\n${learnedSection}\n`;
  }

  const newRule = `- "${issueTitle}" → ${target_team} (corrected from ${corrected_from_team}, ${learned_from_issue}, by ${corrected_by} on ${new Date().toISOString().split("T")[0]})`;

  // Remove the placeholder if present
  rules = rules.replace(
    "(none yet — patterns will be added as engineers provide corrections)\n",
    ""
  );

  // Append new rule
  rules = rules.trimEnd() + "\n" + newRule + "\n";

  // Write back to Knowledge
  await devin.updateKnowledgeNote(noteId, {
    name: note.name,
    body: rules,
    trigger: note.trigger,
    pinned_repo: note.pinned_repo,
  });

  console.log(`[routing] Added learned pattern: "${issueTitle}" → ${target_team}`);

  // Log the correction
  logEvent({
    issue_id: learned_from_issue,
    issue_title: issueTitle,
    action: "routing_corrected",
    path: null,
    confidence: null,
    routing_rule_applied: newRule,
    responsible_team: target_team,
    devin_session_id: null,
    devin_session_url: null,
    pr_url: null,
    metadata: { corrected_by, corrected_from_team },
  });
}
