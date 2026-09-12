# VotePredict deployment policy

VotePredict uses GitHub CI as the branch validation surface and Vercel only as the production runtime. Automatic Vercel Git deployments are disabled for **all** branches; production is deployed by a dedicated GitHub Actions workflow only after the exact `main` commit has passed CI.

The release invariant is: **the exact commit that passed the release gate is the commit that reaches production**.

A second invariant now applies: **`.github/workflows/deploy-production.yml` is the only repository workflow allowed to create a Vercel production deployment.** Audit, refresh, backfill, evaluation, and smoke tooling must operate against an already-deployed release and must never create their own production build.

## Why Git auto-deploys are disabled

The previous configuration attempted to disable feature branches with:

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

That was incorrect for Vercel's current configuration semantics. `deploymentEnabled` object entries are branch names, and unspecified branches default to enabled; the `"*"` key did not function as a wildcard. As a result, routine feature-branch commits still generated previews and contributed to exhausting the project's daily deployment quota.

The corrected repository setting is:

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

This disables automatic Git deployments entirely.

## Production deployment workflow

`.github/workflows/deploy-production.yml` is the sole release mechanism.

It is triggered by completion of the `CI` workflow and runs only when:

- CI concluded `success`;
- the CI run was for `main`;
- the CI run was triggered by a push.

The workflow then:

1. checks out `github.event.workflow_run.head_sha` exactly;
2. verifies the checked-out SHA matches the release SHA and is still current `main`;
3. requires the repository Vercel credential;
4. ensures required production runtime configuration exists before deployment;
5. performs one remote `vercel deploy --prod` against the pinned VotePredict team/project;
6. records the commit and deployment URL in the Actions job summary.

This design prevents a feature branch, failed CI commit, later-moving branch head, audit workflow, or maintenance workflow from being substituted into production or creating an extra deployment.

## Standard release path

1. Push work to a feature branch.
2. GitHub Actions runs the complete `verify` gate:
   - clean migration replay;
   - TypeScript validation;
   - full automated tests;
   - Next.js production build;
   - high-severity production dependency audit.
3. Merge only after release-relevant checks are green.
4. The push to `main` starts a fresh CI run for the merge commit.
5. When that `main` CI run succeeds, `Deploy production` checks out the exact green SHA and starts the single remote Vercel production deployment.
6. Confirm the Vercel deployment reaches `READY` and identifies the expected commit SHA.
7. Confirm production aliases are attached, including `vote.planitnow.us` and `votepredict.vercel.app`.
8. Smoke-test the changed user path.
9. Inspect production 5xx/runtime errors for the new deployment before considering the release complete.

Vercel installs dependencies with `npm ci --no-fund --no-audit` using the committed lockfile.

## Why the production build is remote

VotePredict requires production secrets during the Next.js build/runtime configuration path. `vercel env pull` may intentionally return `[SENSITIVE]` placeholders for secret values, so a local `vercel build --prod` can fail even when the real Vercel production build is healthy.

The release workflow therefore uses Vercel's **remote production build** (`vercel deploy --prod`) so secret values remain server-side and available in the production environment.

## Maintenance and audit tooling

Maintenance capabilities remain available through their application endpoints and scripts, but legacy GitHub workflows that independently deployed production before invoking them were removed. This includes the former evidence-refresh, Revisor audit/refresh, runtime-smoke, and issue-driven Vercel fallback deployment workflows.

When one of these capabilities is needed, it must target the already-deployed production release. It may not create a deployment as a prerequisite. Production model/evaluation audits that remain automated follow the same rule: they verify or wait for the exact release SHA and then inspect that runtime.

`/api/health` exposes the deployed Git commit SHA alongside database/auth health so release tooling can verify which exact commit is currently serving without creating another deployment.

## Deployment quota discipline

Vercel can reject new deployments after the plan's daily deployment allowance is exhausted. VotePredict hit this during the v4 promotion rollout (`api-deployments-free-per-day`).

Operational rules:

- Vercel Git previews stay disabled globally;
- GitHub CI is the default validation surface for feature branches;
- the central CI-gated workflow is the only repository production deployer;
- audits, refreshes, backfills, evaluations, and smoke checks never deploy production themselves;
- previews, when genuinely necessary, are explicit/manual rather than automatic on every push;
- documentation, evaluation, ingestion, and model-training commits do not need a Vercel preview by default;
- when the quota is exhausted, do not weaken validation or deploy a different commit as a workaround;
- retry the exact green release commit once Vercel accepts deployments again.

## Production smoke checklist

A release is complete only after all applicable checks pass:

- deployment state is `READY`;
- deployment metadata identifies the expected release SHA;
- production aliases are attached without alias errors;
- the changed route returns the expected status/redirect for the current authentication state;
- no new production 5xx errors appear for the deployment;
- no relevant runtime-error cluster appears for the changed route;
- Vercel build logs contain no build failure.

For owner-authenticated features, an unauthenticated smoke test validates only routing and the auth boundary. A redirect to `/auth/sign-in` does not prove the signed-in workflow has run end to end.

## Model-serving release additions

When a release changes a production probability model:

1. the candidate must first earn promotion under `docs/EVALUATION_STANDARD.md`;
2. freeze/version the serving artifact and training cutoff;
3. verify serialized-versus-evaluated prediction parity before runtime integration;
4. ensure serving semantics identify the target being predicted;
5. keep introduction-stage and current/floor probabilities separate;
6. test leakage/fallback behavior explicitly;
7. merge only after runtime integration passes the normal release gate;
8. deploy the exact green merge commit through the CI-gated production workflow;
9. smoke-test the model surface and inspect live errors.

## Rollback

If a new production deployment has a material runtime failure:

- stop additional deployments while the failure is diagnosed;
- use Vercel rollback/promote only to a previously known-good production deployment;
- preserve the failing commit and logs for diagnosis;
- fix forward through a reviewed PR when practical;
- never mutate model artifacts or production data simply to make the deployment appear healthy.

## Known non-blocking warning

Current production startup may emit a `pg` / `pg-connection-string` warning about future SSL-mode semantics. It is not a current request failure, but the database connection configuration should move to an explicit intended SSL mode before the next major `pg` behavior change.
