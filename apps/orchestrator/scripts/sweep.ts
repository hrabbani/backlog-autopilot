import "dotenv/config";
import { runSweep } from "../src/sweep.js";

async function main() {
  const args = process.argv.slice(2);

  let issues: string[] | undefined;
  let limit: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--issues" && args[i + 1]) {
      issues = args[i + 1].split(",").map((s) => s.trim());
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  if (!issues && !limit) {
    console.log("[sweep] Running backlog sweep (default batch size: 4)");
    console.log("[sweep] Usage: bun run sweep [--issues TAI-5,TAI-9] [--limit 10]");
  }

  const result = await runSweep({ issues, limit });

  if (result.errors.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[sweep] Fatal error:", err);
  process.exit(1);
});
