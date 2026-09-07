# Deployment policy

VotePredict uses **manual-only Vercel deployments** during the V2 rebuild.

## Why

The project has a limited Vercel deployment/build allowance, while the historical-data and modeling phases require many small repository commits. GitHub Actions is the normal validation path for those commits; a Vercel build is not needed for every parser, schema, test, or model change.

## Automatic Git deployments

`vercel.json` sets:

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

This disables Vercel deployments triggered automatically by Git pushes, pull-request updates, and merges.

## Normal development loop

1. Push changes to a feature branch.
2. Let GitHub Actions run type checking, tests, the Next.js production build, and the dependency audit.
3. Continue development without creating a Vercel deployment.
4. Create a Vercel preview only when a browser/runtime check is useful or explicitly requested.
5. Create/promote a production deployment only when intentionally releasing.

## Manual deploys

Manual deployments can be triggered through the connected Vercel tooling or the Vercel CLI. They are intentionally not embedded in the normal GitHub CI workflow, so ordinary CI cannot consume Vercel build quota by accident.

If a recurring release window becomes useful later, add a deliberately scheduled deployment workflow rather than re-enabling deploy-on-push.
