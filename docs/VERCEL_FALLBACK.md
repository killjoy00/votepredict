# Vercel fallback runbook

Use this only when the normal ChatGPT/Vercel connector cannot access the VotePredict project.

The fallback keeps `VERCEL_TOKEN` inside GitHub Actions secrets. Never paste the token into a GitHub issue, commit, pull request, workflow input, or chat.

## Commands

Create a GitHub issue with one of these exact titles:

- `[vercel-ops] auth-check`
- `[vercel-ops] status`
- `[vercel-ops] deploy-production`

For a production deployment, the issue body must include this exact line:

```text
CONFIRM PRODUCTION DEPLOY
```

The workflow only accepts issues authored by the repository owner and only targets the configured Vercel scope `killjoy00s-projects/votepredict`.

`auth-check` verifies that the GitHub secret can access that project. `status` additionally lists recent production deployments. `deploy-production` checks out protected `main` and sends that source to Vercel for a production build and deployment.

If the workflow reports that `VERCEL_TOKEN` is unavailable, add or replace a repository Actions secret named `VERCEL_TOKEN` under the repository's GitHub Actions secrets settings. Do not put the value in repository variables.
