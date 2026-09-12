# VotePredict deployment policy

VotePredict deploys the protected `main` branch to Vercel production. Ordinary development should be validated in GitHub CI without creating Vercel deployments unless a preview is deliberately needed.

The release goal is simple: **the exact commit that passed the release gate is the commit that reaches production**.

## Normal Git deployment policy

`vercel.json` declares Next.js explicitly and attempts to disable feature-branch Git deployments while leaving `main` enabled:

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

Treat this repository configuration and the Vercel project Git settings as a pair. Do not assume the file alone proves previews are disabled: recent work produced multiple feature-branch deployments and exhausted the project's daily deployment allowance. The deployment list should be checked when unexpected preview activity appears.

## Standard release path

1. Push work to a feature branch.
2. Let GitHub Actions run the complete `verify` gate:
   - clean migration replay;
   - TypeScript validation;
   - full automated tests;
   - Next.js production build;
   - high-severity production dependency audit.
3. Merge only after the release-relevant checks are green.
4. Record the resulting `main` commit SHA.
5. Let the normal `main` Git deployment run when Vercel creates it successfully.
6. Confirm that the Vercel deployment metadata points to that exact `main` SHA and reaches `READY`.
7. Confirm production aliases are attached, including `vote.planitnow.us` and `votepredict.vercel.app`.
8. Smoke-test the changed user path.
9. Inspect production runtime errors and 5xx logs for the new deployment before considering the release complete.

Vercel installs dependencies with `npm ci --no-fund --no-audit`, using the committed `package-lock.json` for reproducible builds.

## Exact-commit fallback deployment

Use a manual/fallback deployment only when the normal Git deployment is missing, blocked, or operationally unusable.

Fallback rules:

- deploy the exact already-green `main` SHA, not an unmerged branch head;
- use the authorized Vercel project/team and production environment;
- prefer a **remote Vercel production build** (`vercel deploy --prod`) when the application requires production secrets at build time;
- do not rely on a local `vercel build --prod` after `vercel env pull` when secret values are returned as `[SENSITIVE]` placeholders;
- after fallback deployment, perform the same SHA/READY/alias/smoke/runtime-log checks as the normal path.

The v4 introduction-model rollout established this fallback pattern: local Vercel build was correctly stopped by redacted secret placeholders, while the remote Vercel build used the server-side production secrets and succeeded.

## Vercel fallback bridge

`.github/workflows/vercel-fallback.yml` provides an owner-only GitHub-side recovery path when direct Vercel tooling is unavailable.

The bridge is intentionally narrow:

- it runs only for issues opened by the repository owner;
- the title must start with `[vercel-ops] `;
- it is pinned to the VotePredict Vercel team/project;
- credentials remain in GitHub Actions secrets;
- raw runtime/application messages are withheld from the public repository;
- production deployment requires an explicit confirmation line.

Supported issue commands are:

- `[vercel-ops] auth-check`
- `[vercel-ops] status`
- `[vercel-ops] errors`
- `[vercel-ops] logs`
- `[vercel-ops] deploy-production`

For `deploy-production`, the issue body must contain exactly:

```text
CONFIRM PRODUCTION DEPLOY
```

## Deployment quota discipline

Vercel can reject new deployments after the plan's daily deployment allowance is exhausted. VotePredict hit this condition during the v4 promotion rollout (`api-deployments-free-per-day`).

Operational policy:

- do not create Vercel previews for routine documentation, evaluation, ingestion, or model-training commits;
- keep feature-branch deployment suppression enabled in both repository and project settings;
- prefer GitHub CI for branch validation;
- consolidate deployment-worthy changes instead of repeatedly pushing preview-only commits;
- when the quota is exhausted, do not weaken validation or deploy a different commit as a workaround;
- retry the exact green `main` commit once Vercel accepts deployments again.

## Production smoke checklist

A production deployment is complete only after all applicable checks pass:

- deployment state is `READY`;
- deployment metadata identifies the expected `main` commit SHA;
- production aliases are attached without alias errors;
- the changed route returns the expected status/redirect for the current authentication state;
- no new production 5xx errors appear for the deployment;
- no relevant runtime-error cluster appears for the changed route;
- no build error is present in Vercel build logs.

For owner-authenticated features, an unauthenticated smoke test may only verify the auth boundary. A successful redirect to `/auth/sign-in` proves routing/auth middleware is alive, not that the authenticated application workflow has been exercised end to end.

## Model-serving release additions

When a release changes a production probability model:

1. the candidate must first earn promotion under `docs/EVALUATION_STANDARD.md`;
2. freeze/version the serving artifact and training cutoff;
3. verify serialized-versus-evaluated prediction parity before runtime integration;
4. ensure serving semantics identify the target being predicted;
5. keep introduction-stage and current/floor probabilities separate;
6. test leakage/fallback behavior explicitly;
7. merge only after the runtime integration passes the normal release gate;
8. deploy the exact green merge commit;
9. smoke-test the model's product surface and inspect live errors.

## Rollback

If the new production deployment has a material runtime failure:

- stop additional deployments while the failure is diagnosed;
- use Vercel rollback/promote only to a previously known-good production deployment;
- preserve the failing commit and logs for diagnosis;
- fix forward through a reviewed PR when practical;
- never mutate model artifacts or production data simply to make the deployment appear healthy.

## Known non-blocking warning

Current production startup may emit a `pg` / `pg-connection-string` warning about future SSL-mode semantics. It is not a current request failure, but the database connection configuration should eventually move to an explicit intended SSL mode (for example `sslmode=verify-full` when that matches the desired behavior) before the next major `pg` upgrade.