import "dotenv/config";
import { getDevinClient } from "../src/devin.js";
import { getDb } from "../src/db.js";
import { getIssueByIdentifier } from "../src/linear.js";
import { triageJsonSchema } from "@backlog-autopilot/shared";
import { trackSession } from "../src/poller.js";
import { logEvent } from "../src/ledger.js";

const PRIORITY_LABELS: Record<number, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

async function main() {
  const issueIdentifier = process.argv[2];
  if (!issueIdentifier) {
    console.error("Usage: bun run demo:trigger <ISSUE-IDENTIFIER>");
    console.error("Example: bun run demo:trigger TAIL-1");
    process.exit(1);
  }

  console.log(`[demo] Triggering triage for ${issueIdentifier}...`);

  // Fetch issue from Linear
  const issue = await getIssueByIdentifier(issueIdentifier);
  if (!issue) {
    console.error(`Issue ${issueIdentifier} not found in Linear`);
    process.exit(1);
  }

  const description = await issue.description;
  console.log(`[demo] Found: ${issue.title}`);
  console.log(`[demo] Description: ${(description ?? "(none)").slice(0, 100)}...`);

  // Get stored config
  const db = getDb();
  const triagePlaybookId = (
    db
      .prepare("SELECT value FROM config_store WHERE key = 'triage_playbook_id'")
      .get() as { value: string } | undefined
  )?.value;
  const routingNoteId = (
    db
      .prepare("SELECT value FROM config_store WHERE key = 'routing_rules_note_id'")
      .get() as { value: string } | undefined
  )?.value;
  const teamNoteId = (
    db
      .prepare("SELECT value FROM config_store WHERE key = 'team_directory_note_id'")
      .get() as { value: string } | undefined
  )?.value;

  if (!triagePlaybookId || !routingNoteId || !teamNoteId) {
    console.error("Missing config. Run setup first: bun run setup");
    process.exit(1);
  }

  // Create Devin triage session
  const devin = getDevinClient();
  const session = await devin.createSession({
    prompt: `Triage this Linear issue:\n\nTitle: ${issue.title}\nIdentifier: ${issueIdentifier}\nDescription: ${description ?? "No description provided"}\nPriority: ${PRIORITY_LABELS[issue.priority] ?? String(issue.priority)}\n\nFill in the structured output schema completely based on your investigation.`,
    playbook_id: triagePlaybookId,
    knowledge_ids: [routingNoteId, teamNoteId],
    structured_output_schema: triageJsonSchema,
    tags: ["triage", issueIdentifier],
    repos: ["hrabbani/tailored"],
    session_links: [issue.url],
  });

  console.log(`[demo] Triage session created: ${session.session_id}`);
  console.log(`[demo] View session: ${session.url}`);

  // Track the session
  trackSession({
    devin_session_id: session.session_id,
    session_type: "triage",
    issue_id: issueIdentifier,
  });

  // Log the event
  logEvent({
    issue_id: issueIdentifier,
    issue_title: issue.title,
    action: "triage_started",
    path: null,
    confidence: null,
    routing_rule_applied: null,
    responsible_team: null,
    devin_session_id: session.session_id,
    devin_session_url: session.url,
    pr_url: null,
    metadata: { source: "demo_trigger" },
  });

  console.log(
    "\n[demo] Session is running. Start the orchestrator to poll for completion."
  );
}

main().catch((err) => {
  console.error("Demo trigger failed:", err);
  process.exit(1);
});
