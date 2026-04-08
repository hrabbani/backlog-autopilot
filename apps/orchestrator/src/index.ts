import "dotenv/config";
import express, { type Express } from "express";
import { loadBlueprint } from "./config.js";
import { getDb } from "./db.js";
import { handleLinearWebhook } from "./webhooks/linear.js";
import { getSlackApp, startSlackApp } from "./slack/app.js";
import { registerSlackHandlers } from "./slack/commands.js";
import { startPoller } from "./poller.js";
import { handleTriageComplete, handleJobComplete } from "./pipeline.js";
import { runSweep } from "./sweep.js";

const app: Express = express();
app.use(express.json());

// CORS for control plane
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Linear webhook
app.post("/api/webhooks/linear", handleLinearWebhook);

// Recent ledger events (for dashboard live view)
app.get("/api/logs", (_req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM ledger_events ORDER BY timestamp DESC LIMIT 50"
      )
      .all() as Array<Record<string, unknown>>;
    const events = rows.map((row) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
    }));
    res.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Sweep trigger
app.post("/api/sweep", async (req, res) => {
  try {
    const { issues, limit } = req.body ?? {};
    console.log("[orchestrator] Sweep triggered via API");
    const result = await runSweep({
      issues: issues as string[] | undefined,
      limit: limit as number | undefined,
    });
    res.json({ status: "ok", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[orchestrator] Sweep API error:", message);
    res.status(500).json({ status: "error", error: message });
  }
});

// Load config on startup
const blueprint = loadBlueprint();
console.log(`[orchestrator] Blueprint loaded (version ${blueprint.version})`);

// Initialize DB
getDb();
console.log("[orchestrator] Database initialized");

// Initialize Slack via Socket Mode (gracefully skip if env vars missing)
try {
  const slackApp = getSlackApp();
  registerSlackHandlers(slackApp);
  startSlackApp().catch((err) => {
    console.error("[orchestrator] Slack Socket Mode failed:", err);
  });
} catch (err) {
  console.warn("[orchestrator] Slack disabled:", (err as Error).message);
}

// Start poller
startPoller({
  onComplete: async (session) => {
    if (session.session_type === "triage") {
      await handleTriageComplete({
        devin_session_id: session.devin_session_id,
        issue_id: session.issue_id,
        structured_output: session.structured_output,
      });
    } else if (session.session_type === "job") {
      await handleJobComplete({
        devin_session_id: session.devin_session_id,
        issue_id: session.issue_id,
        structured_output: session.structured_output,
        pull_requests: session.pull_requests,
      });
    }
  },
  intervalMs: 15_000,
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[orchestrator] Listening on port ${PORT}`);
});

export { app };
