import Database from "better-sqlite3";
import path from "node:path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.resolve(
    import.meta.dirname,
    "../../../data/autopilot.db"
  );

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS ledger_events (
      event_id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      issue_id TEXT NOT NULL,
      issue_title TEXT NOT NULL,
      action TEXT NOT NULL,
      path TEXT,
      confidence REAL,
      routing_rule_applied TEXT,
      responsible_team TEXT,
      devin_session_id TEXT,
      devin_session_url TEXT,
      pr_url TEXT,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS active_sessions (
      devin_session_id TEXT PRIMARY KEY,
      session_type TEXT NOT NULL,
      issue_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      structured_output TEXT
    );

    CREATE TABLE IF NOT EXISTS config_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ledger_issue ON ledger_events(issue_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_action ON ledger_events(action);
    CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON ledger_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON active_sessions(status);
  `);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
