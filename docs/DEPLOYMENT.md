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

**Current deployment posture: paused and manual-only.** Since merged [PR #733](https://github.com/killjoy00/votepredict/pull/733), `.github/workflows/deploy-production.yml` has only a **`workflow_dispatch` trigger**, with a required boolean `run_vercel=true` (default false) and a `main`-branch guard. GitHub CI does **not** automatically dispatch it. **Do not run it while the #732 pause applies** except for a separately documented, explicitly authorized release.

For any future independently authorized manual release:

1. First confirm the target `main` SHA has green CI, including migrations, typecheck, tests, build and production dependency audit. The current manual workflow does **not** independently enforce a green-CI trigger.
2. An explicitly authorized operator manually starts the workflow on that exact current `main` commit with affirmative `run_vercel=true`. The workflow verifies its checked-out SHA and checks that it is still current `main`.
3. The workflow currently invokes `scripts/prepare-production-cron.ts` before remote deployment. That script may **create production CRON_SECRET / FORECAST_BATCH_SIZE environment variables**, so the deployment itself contacts the Vercel control plane and must not be treated as a passive check.
4. One authorized `vercel deploy --prod` is then performed and its URL/SHA recorded. Audit/evidence merges alone never justify a production release.
5. If a release is actually approved, verify the exact deployment and health using only the separately approved bounded smoke plan. Do not revive previous deploy -> smoke -> forecast -> opening-day -> refresh fan-out.

Source-controlled `vercel.json` has `git.deploymentEnabled=false` and no `crons` declaration. **An older deployed cron may still exist:** the live Vercel cron state is **unverified**. #732 owns any future safe verification or removal; a changed repository file is not proof of live shutdown.

## Standard release path (suspended until an intentional release is authorized)

1. Change code on a feature branch and pass GitHub PR CI.
2. Merge into `main` only after the relevant gate is green.
3. Confirm CI for the exact merged `main` SHA.
4. If and only if the operational pause is separately addressed and a release is explicitly approved, manually dispatch the production deployment and verify the current-SHA protection.
5. Check the single deployment result and, if authorized, the minimum applicable health signal without triggering expensive or write-capable secondary workloads.

**No production deployment is required or authorized** to update issue #847 evidence scorecards, offline audit tests, or documentation. For the accurate public-evidence refresh state see [Evidence program operating scorecard](evaluation/evidence-program-scorecard.md) and [#732](https://github.com/killjoy00/votepredict/issues/732).

## Why the production build is remote

VotePredict requires production secrets during the Next.js build/runtime configuration path. `vercel env pull` may intentionally return `[SENSITIVE]` placeholders for secret values, so a local `vercel build --prod` can fail even when the real Vercel production build is healthy.

The release workflow therefore uses Vercel's **remote production build** (`vercel deploy --prod`) so secret values remain server-side and available in the production environment.

## Maintenance and audit tooling

Most historical evaluation, source audits and evidence ingestion code remains in the repository, but **availability of code is not permission to operate it**. #733 made the identified Vercel-dependent maintenance entrypoints manual-only. Several other issue-command workflows still retrieve production configuration through `vercel env pull`; do not execute them under #732 without an independently reviewed, Vercel-free conversion or an explicitly approved exception. Never deploy production as an incidental prerequisite for source research.

The current `public-evidence-refresh.yml` uses a GitHub runner **but still pulls Vercel production environment variables**, then calls a **write-capable** direct-Neon collector. No six-hour/post-deploy refresh currently runs from that workflow, and the as-of freshness of production evidence was **not** certified by source inspection. The safe future alternative is a protected direct-Neon credential with **separate read-only health and separately authorized write** stages; it is a proposal, not an activated path. See [the current evidence scorecard](evaluation/evidence-program-scorecard.md).

`/api/health` can reveal a deployed SHA in a deliberate, approved health check, but this documentation-only exercise performs **no** Vercel or production request.

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
