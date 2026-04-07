import Database from "better-sqlite3";
import path from "node:path";
import type { LedgerEvent } from "@backlog-autopilot/shared";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dbPath = path.resolve(process.cwd(), "../../data/autopilot.db");
    _db = new Database(dbPath, { readonly: true });
  }
  return _db;
}

export function getLedgerEvents(options?: {
  limit?: number;
  offset?: number;
  action?: string;
}): LedgerEvent[] {
  const db = getDb();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = "SELECT * FROM ledger_events";
  const params: Record<string, unknown> = { limit, offset };

  if (options?.action) {
    query += " WHERE action = @action";
    params.action = options.action;
  }

  query += " ORDER BY timestamp DESC LIMIT @limit OFFSET @offset";

  const rows = db.prepare(query).all(params) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
  })) as LedgerEvent[];
}

export function getMetrics(): {
  issues_triaged: number;
  prs_created: number;
  prs_merged: number;
} {
  const db = getDb();

  const row = db
    .prepare(
      `SELECT
        COUNT(CASE WHEN action = 'triage_completed' THEN 1 END) AS issues_triaged,
        COUNT(CASE WHEN action = 'pr_created' THEN 1 END) AS prs_created,
        COUNT(CASE WHEN action = 'pr_merged' THEN 1 END) AS prs_merged
      FROM ledger_events`
    )
    .get() as {
    issues_triaged: number;
    prs_created: number;
    prs_merged: number;
  };

  return row;
}

export function getConfigValue(key: string): string | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM config_store WHERE key = @key")
    .get({ key }) as { value: string } | undefined;
  return row?.value;
}
