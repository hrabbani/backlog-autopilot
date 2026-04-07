import "dotenv/config";
import express, { type Express } from "express";
import { loadBlueprint } from "./config.js";
import { getDb } from "./db.js";
import { handleLinearWebhook } from "./webhooks/linear.js";
import { getSlackApp } from "./slack/app.js";
import { registerSlackHandlers } from "./slack/commands.js";

const app: Express = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Linear webhook
app.post("/api/webhooks/linear", handleLinearWebhook);

// Load config on startup
const blueprint = loadBlueprint();
console.log(`[orchestrator] Blueprint loaded (version ${blueprint.version})`);

// Initialize DB
getDb();
console.log("[orchestrator] Database initialized");

// Initialize Slack (gracefully skip if env vars missing)
try {
  const slackApp = getSlackApp();
  registerSlackHandlers(slackApp);
  app.use("/api/slack", (slackApp as any).receiver);
  console.log("[orchestrator] Slack initialized");
} catch (err) {
  console.warn("[orchestrator] Slack disabled:", (err as Error).message);
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[orchestrator] Listening on port ${PORT}`);
});

export { app };
