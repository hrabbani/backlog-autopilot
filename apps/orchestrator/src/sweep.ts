import { getBacklogIssues, getIssueByIdentifier } from "./linear.js";
import { triggerTriage } from "./pipeline.js";
import { getDb } from "./db.js";

interface SweepOptions {
  issues?: string[];
  limit?: number;
}

interface SweepResult {
  processed: string[];
  skipped: string[];
  errors: Array<{ issueId: string; error: string }>;
}

export async function runSweep(options: SweepOptions = {}): Promise<SweepResult> {
  const db = getDb();
  const limit = options.limit ?? 4;

  const result: SweepResult = {
    processed: [],
    skipped: [],
    errors: [],
  };

  let issueData: Array<{
    identifier: string;
    title: string;
    description?: string;
    url: string;
    priority: number;
    labels: string[];
    dueDate?: string;
  }>;

  if (options.issues && options.issues.length > 0) {
    console.log(`[sweep] Processing ${options.issues.length} specified issues`);
    const resolved = await Promise.all(
      options.issues.map(async (id) => {
        const issue = await getIssueByIdentifier(id);
        if (!issue) {
          console.warn(`[sweep] Issue ${id} not found in Linear, skipping`);
          result.errors.push({ issueId: id, error: "Not found in Linear" });
          return null;
        }
        const labels = await issue.labels();
        return {
          identifier: id,
          title: issue.title,
          description: (await issue.description) ?? undefined,
          url: issue.url,
          priority: issue.priority,
          labels: labels.nodes.map((l) => l.name),
          dueDate: issue.dueDate ?? undefined,
        };
      })
    );
    issueData = resolved.filter((i): i is NonNullable<typeof i> => i !== null);
  } else {
    const teamId = (
      db
        .prepare("SELECT value FROM config_store WHERE key = 'linear_team_id'")
        .get() as { value: string } | undefined
    )?.value;

    if (!teamId) {
      console.error("[sweep] Missing linear_team_id in config_store. Run setup first.");
      return result;
    }

    console.log(`[sweep] Querying backlog for team ${teamId}, limit ${limit}`);
    const backlogIssues = await getBacklogIssues(teamId, { limit: 50 });

    issueData = await Promise.all(
      backlogIssues.map(async (issue) => {
        const labels = await issue.labels();
        return {
          identifier: issue.identifier,
          title: issue.title,
          description: (await issue.description) ?? undefined,
          url: issue.url,
          priority: issue.priority,
          labels: labels.nodes.map((l) => l.name),
          dueDate: issue.dueDate ?? undefined,
        };
      })
    );
  }

  const alreadyTriaged = new Set<string>();
  for (const issue of issueData) {
    const existing = db
      .prepare(
        "SELECT COUNT(*) as count FROM ledger_events WHERE issue_id = @issueId AND action = 'triage_started'"
      )
      .get({ issueId: issue.identifier }) as { count: number };
    if (existing.count > 0) {
      alreadyTriaged.add(issue.identifier);
    }
  }

  const newIssues = issueData.filter((i) => !alreadyTriaged.has(i.identifier));
  result.skipped = [...alreadyTriaged];

  if (result.skipped.length > 0) {
    console.log(`[sweep] Skipping ${result.skipped.length} already-triaged: ${result.skipped.join(", ")}`);
  }

  const toProcess = newIssues.slice(0, limit);
  console.log(`[sweep] Processing ${toProcess.length} issues: ${toProcess.map((i) => i.identifier).join(", ")}`);

  for (const issue of toProcess) {
    try {
      await triggerTriage(issue);
      result.processed.push(issue.identifier);
      console.log(`[sweep] Triggered triage for ${issue.identifier}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ issueId: issue.identifier, error: message });
      console.error(`[sweep] Failed to trigger ${issue.identifier}: ${message}`);
    }
  }

  console.log(`\n[sweep] Sweep complete: ${result.processed.length} processed, ${result.skipped.length} skipped, ${result.errors.length} errors`);

  return result;
}
