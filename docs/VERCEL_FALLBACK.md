# Vercel fallback runbook

Use this only when the normal ChatGPT/Vercel connector cannot access the VotePredict project.

The fallback keeps `VERCEL_TOKEN` inside GitHub Actions secrets. Never paste the token into a GitHub issue, commit, pull request, workflow input, or chat.

## Commands

Create a GitHub issue with one of these exact titles:

- `[vercel-ops] auth-check`
- `[vercel-ops] status`
- `[vercel-ops] errors`
- `[vercel-ops] logs`
- `[vercel-ops] deploy-production`

For a production deployment, the issue body must include this exact line:

```text
CONFIRM PRODUCTION DEPLOY
```

The workflow only accepts issues authored by the repository owner and only targets the configured Vercel scope `killjoy00s-projects/votepredict`.

## Read operations

`auth-check` verifies that the GitHub secret can access the project.

`status` lists recent production deployments and their readiness state.

`errors` queries up to 200 production requests with 5xx status codes from the last 24 hours. It reports only aggregate counts by normalized route/status, log level, and source.

`logs` queries up to 200 production runtime-log entries from the last hour. It reports only aggregate counts by normalized route/status, log level, and source.

Because this repository is public, the workflow never prints, comments, or uploads raw Vercel log messages. Raw JSON returned by Vercel exists only in the ephemeral GitHub Actions runner for the duration of the job. Query strings are removed from paths, and email-like, long numeric, UUID/hash-like, and long opaque path segments are redacted before a summary is emitted.

## Production deployment

`deploy-production` checks out protected `main` and sends that source to Vercel for a production build and deployment. It requires the explicit confirmation line shown above.

If the workflow reports that `VERCEL_TOKEN` is unavailable, add or replace a repository Actions secret named `VERCEL_TOKEN` under the repository's GitHub Actions secrets settings. Do not put the value in repository variables.
