import { LinearClient, type Issue } from "@linear/sdk";

let client: LinearClient | null = null;

export function getLinearClient(): LinearClient {
  if (!client) {
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) throw new Error("LINEAR_API_KEY must be set");
    client = new LinearClient({ apiKey });
  }
  return client;
}

export async function getIssue(issueId: string): Promise<Issue> {
  const linear = getLinearClient();
  return linear.issue(issueId);
}

export async function getIssueByIdentifier(
  identifier: string
): Promise<Issue | null> {
  const linear = getLinearClient();
  // Parse identifier like "TEAM-123" into team key and issue number
  const match = identifier.match(/^([A-Za-z]+)-(\d+)$/);
  if (!match) throw new Error(`Invalid issue identifier: ${identifier}`);
  const [, teamKey, numberStr] = match;
  const issues = await linear.issues({
    filter: {
      team: { key: { eq: teamKey } },
      number: { eq: parseInt(numberStr, 10) },
    },
    first: 1,
  });
  return issues.nodes[0] ?? null;
}

export async function updateIssueState(
  issueId: string,
  stateId: string
): Promise<void> {
  const linear = getLinearClient();
  await linear.updateIssue(issueId, { stateId });
}

export async function addIssueComment(
  issueId: string,
  body: string
): Promise<void> {
  const linear = getLinearClient();
  await linear.createComment({ issueId, body });
}

export async function assignIssue(
  issueId: string,
  assigneeId: string
): Promise<void> {
  const linear = getLinearClient();
  await linear.updateIssue(issueId, { assigneeId });
}

export async function addIssueLabel(
  issueId: string,
  labelId: string
): Promise<void> {
  const linear = getLinearClient();
  const issue = await linear.issue(issueId);
  const existingLabels = await issue.labels();
  const labelIds = existingLabels.nodes.map((l) => l.id);
  labelIds.push(labelId);
  await linear.updateIssue(issueId, { labelIds });
}

export async function getBacklogIssues(
  teamId: string,
  options?: { limit?: number }
): Promise<Issue[]> {
  const linear = getLinearClient();
  const issues = await linear.issues({
    filter: {
      team: { id: { eq: teamId } },
      state: { type: { in: ["backlog", "unstarted", "triage"] } },
    },
    orderBy: "priority" as any,
    first: options?.limit ?? 20,
  });
  return issues.nodes;
}
