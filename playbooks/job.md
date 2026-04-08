# Job Playbook

You are fixing a backlog issue for the Tailored project. You have been given the triage context including the root cause hypothesis, affected files, and suggested approach.

## Procedure

1. Read the triage context provided in the prompt to understand the issue and proposed fix.
2. Investigate the affected files to confirm the root cause hypothesis.
3. Implement the fix following the suggested approach, or adjust if you find a better solution.
4. Run lint checks before committing: check for TypeScript errors with `bunx tsc --noEmit`.
5. If tests exist for the affected area, run them. If no tests exist, write a minimal test that proves the fix works.
6. Record a video of yourself running the tests to verify the fix. Do NOT test by launching the full app and navigating the UI unless the fix is purely visual and cannot be verified any other way.
7. Commit your changes with a clear commit message referencing the issue.
8. Create a branch named using the Linear issue identifier in lowercase (e.g. `tai-7-fix-description`). The identifier MUST appear in the branch name for Linear to auto-link the PR and update the issue status.
9. Push your branch and create a pull request. In the PR description, include: what was wrong, what you changed, how to verify, and the verification video.
10. Once the PR is created, finish the session. Do not wait for further instructions.

## Specifications

- The fix should be minimal and focused — do not refactor unrelated code.
- The PR title should start with "fix:" for bugs or "feat:" for features, followed by the issue identifier (e.g. "fix(TAI-7): correct ICP overlap logic").
- The branch name MUST contain the Linear issue identifier in lowercase (e.g. `tai-7-fix-description`) — this is how Linear auto-links PRs and moves issues to "In Review".
- Include the Linear issue identifier in the PR description.

## Testing UI & Personalization (only if needed)

Only use this flow if the fix is purely visual and CANNOT be verified through written tests. Prefer writing a test and recording yourself running it — this is much faster.

1. Start each service separately:
   - Redis: `docker run -d --name redis -p 6379:6379 redis:7-alpine`
   - Web dashboard: `bun run dev:web` (port 3000)
   - Demo site: `bun run dev:demo` (port 3001)
   - Worker: `set -a && source .env.local && set +a && bun run --watch apps/worker/src/index.ts`
2. Open the dashboard at http://localhost:3000.
3. **Reset demo data**: Go to Configure (http://localhost:3000/settings), scroll to the bottom, click "Reset All Demo Data" and confirm.
4. **Index the repo**: Run `./scripts/tailored-sync.sh` — this analyzes the demo landing page, extracts content zones, and pushes indexed data to the platform.
5. **Import companies**: Go to Integrations (http://localhost:3000/integrations), connect HubSpot with your token, then click "Import Companies". Select companies and import them.
6. **Trigger personalization**: Go to Visitors (http://localhost:3000/simulate), select a company, and click "Generate Pages".
7. **Verify**: Go to Pages (http://localhost:3000/pages), wait for status to change from "generating" to "ready", then click the page card to view personalized content for each zone.

Use this flow to verify any fix that affects the dashboard, visitor flow, page generation, or zone rendering.

## Known Issues

- Devin's browser environment does not render personalized content inside iframes on generated pages. If you are testing personalization or page generation, treat a successful job completion (status "ready" on the Pages dashboard) as the success criteria — do not try to visually verify iframe content.

## Advice

- Environment secrets (ANTHROPIC_API_KEY, SUPABASE_URL, etc.) are available via Devin Secrets. If a required env var is missing, skip the test that needs it and note it in the PR — do NOT ask for the key or block on it.
- This is a Bun monorepo. Use `bun` for all commands.
- To run the web app: `bun run dev:web` (port 3000)
- To run the demo site: `bun run dev:demo` (port 3001)
- To run the worker: `set -a && source .env.local && set +a && bun run --watch apps/worker/src/index.ts`
- Redis must be running for the worker: `docker run -d --name redis -p 6379:6379 redis:7-alpine`
- Do NOT modify AI prompts in packages/ai/src/prompts unless the ticket specifically asks for it.
- Do NOT modify Supabase migrations unless the ticket specifically asks for it.

## Forbidden Actions

- Do NOT modify files outside the scope of the issue
- Do NOT change environment variables or secrets
- Do NOT modify the project configuration (package.json, tsconfig, etc.) unless required by the fix
