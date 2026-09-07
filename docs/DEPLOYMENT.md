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

## Manual deploys

Manual Vercel deployments and promotions remain available for recovery, previews, or deliberately staged releases. They are not part of ordinary feature-branch CI.
