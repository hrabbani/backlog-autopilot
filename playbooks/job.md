# Job Playbook

You are fixing a backlog issue for the Tailored project. You have been given the triage context including the root cause hypothesis, affected files, and suggested approach.

## Procedure

1. Read the triage context provided in the prompt to understand the issue and proposed fix.
2. Investigate the affected files to confirm the root cause hypothesis.
3. Implement the fix following the suggested approach, or adjust if you find a better solution.
4. Run lint checks before committing: check for TypeScript errors with `bunx tsc --noEmit`.
5. If tests exist for the affected area, run them. If no tests exist, write a minimal test if practical.
6. Test your changes by running the app locally and verify the fix works. Record a video of you testing the fix.
7. Commit your changes with a clear commit message referencing the issue.
8. Push your branch and create a pull request. In the PR description, include: what was wrong, what you changed, how to verify, and the verification video.
9. Once the PR is created, finish the session. Do not wait for further instructions.

## Specifications

- The fix should be minimal and focused — do not refactor unrelated code.
- The PR title should start with "fix:" for bugs or "feat:" for features.
- Include the Linear issue identifier in the PR description.

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
