import "dotenv/config";
import express, { type Express } from "express";
import { loadBlueprint } from "./config.js";

const app: Express = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Load config on startup
const blueprint = loadBlueprint();
console.log(
  `[orchestrator] Blueprint loaded (version ${blueprint.version})`
);
console.log(
  `[orchestrator] Policy blocked paths: ${blueprint.policy.blocked_paths.join(", ")}`
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[orchestrator] Listening on port ${PORT}`);
});

export { app };
