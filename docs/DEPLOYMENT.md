# Deployment policy

VotePredict deploys the protected `main` branch to Vercel production automatically. Feature-branch Git deployments remain disabled so ordinary development and CI do not consume Vercel build quota.

## Automatic Git deployments

`vercel.json` uses overlapping branch rules:

```json
{
  "git": {
    "deploymentEnabled": {
      "*": false,
      "main": true
    }
  }
}
```

Vercel treats a branch as deployable when at least one matching rule is `true`, so `main` deploys while other branches do not.

## Release path

1. Push work to a feature branch.
2. Let GitHub Actions run type checking, tests, a clean migration replay, the Next.js production build, and the dependency audit.
3. Merge the pull request only after the protected `verify` check succeeds.
4. The resulting push to `main` triggers the Vercel production deployment.
5. Verify the production health endpoint and the changed user path after the deployment is ready.

Vercel installs dependencies with `npm ci --no-fund --no-audit`, using the committed `package-lock.json` for reproducible production builds.

## Vercel fallback bridge

`.github/workflows/vercel-fallback.yml` provides a GitHub-side recovery path when the ChatGPT/Vercel OAuth connector cannot discover the account or team. The Vercel token stays in GitHub Actions secrets and is never copied into an issue, commit, workflow output, or chat.

The bridge is intentionally narrow:

- It runs only for issues opened by the repository owner.
- The issue title must start with `[vercel-ops] `.
- It is pinned to Vercel team `killjoy00s-projects` and project `votepredict`.
- It never prints the token or pulls environment-variable values.
- Raw runtime/application log messages are never exposed because this repository is public.
- Diagnostic commands emit only sanitized aggregate summaries; query strings and identifier-like path segments are removed or normalized.
- Production deployment requires an explicit confirmation line in the issue body.

### Required GitHub secret

GitHub Actions must expose a secret named `VERCEL_TOKEN` to this repository. A repository Actions secret is the simplest option. If an organization secret is used, that organization must own the repository and the secret must be shared with it; an organization secret cannot be inherited by a repository owned by a personal GitHub account.

### Supported requests

Open an issue with one of these exact titles:

- `[vercel-ops] auth-check` — verifies the token can access the configured Vercel project.
- `[vercel-ops] status` — verifies access and prints a short list of recent production deployments.
- `[vercel-ops] errors` — queries up to 200 production 5xx requests from the last 24 hours and emits a sanitized aggregate summary.
- `[vercel-ops] logs` — queries up to 200 production runtime-log entries from the last hour and emits a sanitized aggregate summary.
- `[vercel-ops] deploy-production` — deploys the current protected `main` branch directly to Vercel production.

For `deploy-production`, the issue body must contain this line exactly:

```text
CONFIRM PRODUCTION DEPLOY
```

The workflow comments on the issue with success/failure and, when applicable, the sanitized diagnostic summary or production deployment URL. Raw Vercel credentials and raw runtime log messages are never echoed.

This issue-based command surface is deliberate: it lets an authorized GitHub client create a Vercel operation without pushing an ops commit or generating an unwanted Vercel preview deployment.

## Manual deploys

Manual Vercel deployments and promotions remain available for recovery, previews, or deliberately staged releases. They are not part of ordinary feature-branch CI.
