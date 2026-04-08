import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getDevinClient } from "../src/devin.js";
import { getDb } from "../src/db.js";

async function main() {
  console.log("=== Backlog Autopilot Setup ===\n");

  const devin = getDevinClient();
  const db = getDb();

  const getConfig = (key: string): string | undefined =>
    (db.prepare("SELECT value FROM config_store WHERE key = @key").get({ key }) as { value: string } | undefined)?.value;

  // 1. Create or update triage playbook
  const triagePlaybookContent = fs.readFileSync(
    path.resolve(import.meta.dirname, "../../../playbooks/triage.md"),
    "utf-8"
  );
  const existingTriageId = getConfig("triage_playbook_id");
  let triagePlaybookId: string;
  if (existingTriageId) {
    console.log(`[setup] Updating triage playbook (${existingTriageId})...`);
    await devin.updatePlaybook(existingTriageId, {
      title: "Backlog Autopilot — Triage",
      body: triagePlaybookContent,
      macro: "!ba-triage",
    });
    triagePlaybookId = existingTriageId;
  } else {
    console.log("[setup] Creating triage playbook...");
    const triagePlaybook = await devin.createPlaybook({
      title: "Backlog Autopilot — Triage",
      body: triagePlaybookContent,
      macro: "!ba-triage",
    });
    triagePlaybookId = triagePlaybook.playbook_id;
    db.prepare(
      "INSERT OR REPLACE INTO config_store (key, value) VALUES ('triage_playbook_id', @value)"
    ).run({ value: triagePlaybookId });
  }
  console.log(`  Triage playbook: ${triagePlaybookId}`);

  // 2. Create or update job playbook
  const jobPlaybookContent = fs.readFileSync(
    path.resolve(import.meta.dirname, "../../../playbooks/job.md"),
    "utf-8"
  );
  const existingJobId = getConfig("job_playbook_id");
  let jobPlaybookId: string;
  if (existingJobId) {
    console.log(`[setup] Updating job playbook (${existingJobId})...`);
    await devin.updatePlaybook(existingJobId, {
      title: "Backlog Autopilot — Job",
      body: jobPlaybookContent,
      macro: "!ba-job",
    });
    jobPlaybookId = existingJobId;
  } else {
    console.log("[setup] Creating job playbook...");
    const jobPlaybook = await devin.createPlaybook({
      title: "Backlog Autopilot — Job",
      body: jobPlaybookContent,
      macro: "!ba-job",
    });
    jobPlaybookId = jobPlaybook.playbook_id;
    db.prepare(
      "INSERT OR REPLACE INTO config_store (key, value) VALUES ('job_playbook_id', @value)"
    ).run({ value: jobPlaybookId });
  }
  console.log(`  Job playbook: ${jobPlaybookId}`);

  // 3. Create or update routing rules Knowledge note
  const routingRulesContent = `# Routing Rules

## Package Routing
- Issues mentioning "queue", "job", "worker", "BullMQ", "Redis" → apps/worker → team-platform
- Issues mentioning "personalization", "zone", "landing page", "generation", "Claude", "AI" → packages/ai → team-ai
- Issues mentioning "dashboard", "settings", "UI", "page", "layout" → apps/web → team-frontend
- Issues mentioning "SDK", "embed", "script tag", "widget" → packages/sdk → team-sdk
- Issues mentioning "demo", "demo site" → apps/demo → team-frontend
- Issues mentioning "types", "shared", "schema" → packages/shared → team-platform

## Learned Patterns
(none yet — patterns will be added as engineers provide corrections)
`;
  const routingNoteParams = {
    name: "Routing Rules",
    body: routingRulesContent,
    trigger: "backlog triage, issue routing, team assignment, package routing, component ownership",
    pinned_repo: "hrabbani/tailored",
  };
  const existingRoutingId = getConfig("routing_rules_note_id");
  let routingNoteId: string;
  if (existingRoutingId) {
    console.log(`[setup] Updating routing rules note (${existingRoutingId})...`);
    await devin.updateKnowledgeNote(existingRoutingId, routingNoteParams);
    routingNoteId = existingRoutingId;
  } else {
    console.log("[setup] Creating routing rules Knowledge note...");
    const routingNote = await devin.createKnowledgeNote(routingNoteParams);
    routingNoteId = routingNote.note_id;
    db.prepare(
      "INSERT OR REPLACE INTO config_store (key, value) VALUES ('routing_rules_note_id', @value)"
    ).run({ value: routingNoteId });
  }
  console.log(`  Routing rules: ${routingNoteId}`);

  // 4. Create or update team directory Knowledge note
  const teamDirectory = `# Team Directory

IMPORTANT: When filling in the "responsible_team" field in the structured output, you MUST use the exact team ID (e.g., "team-ai", "team-platform"). Do NOT use the display name. Always assign exactly ONE team.

## team-ai (AI Team)
- Slack channel: #team-ai
- Owns: packages/ai
- Focus: AI research, personalization logic, zone generation

## team-platform (Platform Team)
- Slack channel: #team-platform
- Owns: apps/worker, packages/shared, supabase/migrations
- Focus: Job processing, infrastructure, database, shared types

## team-frontend (Frontend Team)
- Slack channel: #team-frontend
- Owns: apps/web, apps/demo
- Focus: Dashboard UI, demo site, user-facing features

## team-sdk (SDK Team)
- Slack channel: #team-sdk
- Owns: packages/sdk
- Focus: React SDK, embed script, customer integrations
`;
  const teamNoteParams = {
    name: "Team Directory",
    body: teamDirectory,
    trigger: "team assignment, slack channel, team ownership, who owns this code",
    pinned_repo: "hrabbani/tailored",
  };
  const existingTeamId = getConfig("team_directory_note_id");
  let teamNoteId: string;
  if (existingTeamId) {
    console.log(`[setup] Updating team directory note (${existingTeamId})...`);
    await devin.updateKnowledgeNote(existingTeamId, teamNoteParams);
    teamNoteId = existingTeamId;
  } else {
    console.log("[setup] Creating team directory Knowledge note...");
    const teamNote = await devin.createKnowledgeNote(teamNoteParams);
    teamNoteId = teamNote.note_id;
    db.prepare(
      "INSERT OR REPLACE INTO config_store (key, value) VALUES ('team_directory_note_id', @value)"
    ).run({ value: teamNoteId });
  }
  console.log(`  Team directory: ${teamNoteId}`);

  // 5. Store Linear team ID for sweep queries
  const { getLinearClient } = await import("../src/linear.js");
  const linear = getLinearClient();
  const teamsResult = await linear.teams();
  const tailoredTeam = teamsResult.nodes.find((t: any) => t.key === "TAI");
  if (tailoredTeam) {
    db.prepare(
      "INSERT OR REPLACE INTO config_store (key, value) VALUES ('linear_team_id', @value)"
    ).run({ value: tailoredTeam.id });
    console.log(`[setup] Stored linear_team_id: ${tailoredTeam.id}`);
  } else {
    console.warn("[setup] Could not find TAI team in Linear");
  }

  // 6. Summary
  console.log("\n=== Setup Complete ===");
  console.log(`Triage playbook: ${triagePlaybookId}`);
  console.log(`Job playbook:    ${jobPlaybookId}`);
  console.log(`Routing rules:   ${routingNoteId}`);
  console.log(`Team directory:  ${teamNoteId}`);
  console.log(
    "\nRun `bun --filter orchestrator dev` to start the orchestrator."
  );
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
