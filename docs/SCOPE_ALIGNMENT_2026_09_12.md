# VotePredict scope and deployment alignment — 2026-09-12

## Purpose

This audit was performed immediately after production promotion of the Minnesota 2025-26 introduction-stage model `intro-title-text-eb-v4`.

The review asked:

1. Has the project drifted from the V2 charter/rebuild scope?
2. Do the baseline architecture, evaluation, operations, and deployment documents still describe the product that is actually running?
3. Does the deployment configuration enforce the release discipline those documents claim?

## Conclusion

**No harmful product-scope drift was found.**

The introduction-stage source-chamber forecast is a legitimate extension of the original chamber-passage mission because it follows the same core principles:

- official legislative sources;
- private-first professional workflow;
- empirically evaluated probabilities;
- leakage-safe historical testing;
- model replaceability;
- explicit provenance;
- no claim to predict final enactment into law.

The meaningful drift was in documentation and deployment operations, not model scope:

- the original charter/architecture described chamber passage almost exclusively as the current/floor member-derived probability;
- the old Vercel branch configuration did not actually suppress feature-branch previews under current Vercel semantics.

Both issues are corrected in this refresh.

## Current forecast taxonomy

### Introduction forecast

Question: **At introduction, what is the probability this bill eventually passes its originating chamber during the biennium?**

Properties:

- unconditional from introduction;
- complete introduced-bill universe, including bills that never receive a floor vote;
- source-chamber passage outcome;
- only information knowable at introduction;
- session-pinned frozen serving artifact;
- currently Minnesota 2025-26 `intro-title-text-eb-v4`.

### Current/floor forecast

Question: **Given the information available now, what is the probability this bill passes the selected chamber vote?**

Properties:

- conditional on the current/as-of forecast state;
- member-level vote probabilities;
- chamber probability derived from those member probabilities;
- Quick/Deep evidence workflows;
- immutable forecast revisions and production scorecard.

These probabilities are not interchangeable and must remain visibly labeled in the UI, API, evaluation, and operations layers.

## Baseline-document review

### `CHARTER.md` — updated

The old mission/forecast-philosophy language implied all passage probabilities should be member-derived. The refreshed charter explicitly defines both introduction and current/floor targets and narrows the member-derived rule to the current/floor product.

### `docs/ARCHITECTURE_V2.md` — updated

The original single forecast pipeline no longer fully described production. The refreshed architecture adds a separate introduction-time snapshot/frozen-artifact path alongside the current member/evidence/chamber path.

### `docs/EVALUATION_STANDARD.md` — updated

The original standard centered on floor/member forecasting. The refreshed standard defines target-specific populations, metrics, leakage rules, chronological evaluation, and promotion gates for introduction-stage models while preserving the existing member/floor discipline.

### `docs/OPERATIONS.md` — updated

The v4 work demonstrated that the safest promotion sequence is:

1. evaluation and explicit promotion decision;
2. separate serving-artifact/runtime integration;
3. exact-commit deployment and live validation.

Operations now codifies that sequence rather than allowing a candidate to alter serving merely because evaluation code exists.

### `docs/DEPLOYMENT.md` — updated and deployment control corrected

The deployment review found a real infrastructure bug. The prior configuration was:

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

Under current Vercel semantics, object keys are branch names and unspecified branches default to enabled. `"*"` was not acting as a wildcard. Feature-branch commits were therefore still creating previews, including multiple commits in this audit branch, and this behavior explains the otherwise surprising deployment volume that contributed to the daily quota failure during v4 promotion.

The fix is:

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

All automatic Vercel Git deployments are now disabled in repository configuration. A new `.github/workflows/deploy-production.yml` becomes the normal release path: after a successful push-triggered CI run on `main`, it checks out the exact CI-passed SHA and performs a remote Vercel production deployment.

This gives VotePredict a clearer invariant: branch work costs GitHub CI only; Vercel is used for explicit production releases unless a preview is intentionally requested.

### `README.md` — updated

The implementation summary names both forecast surfaces, the production introduction model, and the exact-green-commit deployment rule.

### `docs/modeling/source-chamber-introduction-v4.md` — updated

The model document records the authoritative corpus, serving contract, exact production promotion/deployment identity, and production validation state.

### `docs/DATA_AND_EVIDENCE.md` — reviewed; no rewrite required now

Its official-source hierarchy, provenance rules, historical-version discipline, conflict handling, and source-quality policy remain consistent with the introduction work. Introduction-specific timing/text eligibility is governed more precisely by the charter, architecture, evaluation standard, operations policy, and v4 model document.

### `docs/REBUILD_PLAN.md` — reviewed; retain as historical implementation plan

The rebuild plan is historical design provenance for the clean-slate V2 sequence. It should not be continuously renumbered to match every post-beta model experiment. The introduction forecast is a post-foundation evaluated product extension, not evidence that the original mission changed.

## Production state after v4 promotion

- promoted application commit: `f5d855bf669ac74a844b343ec248a6866b0f60bc`;
- production deployment: `dpl_VhST7gkrhXeMZYWr6JQoczJdPfsQ`;
- deployment state: `READY`;
- production aliases include `vote.planitnow.us` and `votepredict.vercel.app`;
- production build completed successfully;
- `/dashboard/introduction` returned the expected owner-auth redirect when probed without a session;
- no 5xx requests were observed immediately after deployment;
- no runtime-error cluster was observed for `/dashboard/introduction` or `/api/introduction-forecast` in the initial post-deploy window.

A non-fatal PostgreSQL client warning about future SSL-mode semantics was observed on sign-in startup. It is an infrastructure-maintenance item, not a current v4 serving failure.

## Updated deployment/operations plan

### P0 — release-control and production confidence

1. Merge the corrected Vercel configuration and CI-gated production deployment workflow only after normal CI passes.
2. Verify that commits made after `git.deploymentEnabled=false` no longer create automatic feature-branch Vercel previews.
3. After merge, verify the merge commit passes `main` CI and that `Deploy production` deploys that exact SHA once.
4. Confirm the resulting production deployment is `READY`, has the expected aliases, and produces no new relevant 5xx/runtime errors.
5. Continue normal owner use of `/dashboard/introduction` so the authenticated API path receives real production exercise.
6. Review production errors/logs after meaningful authenticated usage, especially `/api/introduction-forecast`.
7. Make PostgreSQL SSL intent explicit before the next major `pg` behavior change.

### P1 — production accountability

1. Add/confirm a production introduction scorecard keyed to `source_chamber_passage`, not individual floor-vote outcomes.
2. Retain introduction forecast/model provenance needed to score current-session predictions later.
3. Surface model/version and forecast-stage language clearly enough that an owner cannot confuse the introduction prior with a floor probability.
4. Add monitoring/operations visibility for introduction corpus completeness gates where useful.

### P2 — next model cycle

1. Do not tune v4 retroactively against the same holdout and call it v4.
2. Evaluate any v5 candidate as a new frozen model with chronological holdouts and an explicit ablation against v4.
3. Candidate signals must be historically available at introduction; current sponsor/companion state remains ineligible without historical provenance.
4. Promote only if probability quality improves enough to justify added complexity.

### P3 — future Minnesota session rollover

Before serving a new session:

1. complete the authoritative new-session introduced-bill universe pipeline;
2. verify exact introduction-time metadata/document eligibility rules;
3. train a new session artifact only on completed prior sessions;
4. evaluate/validate the new artifact under the introduction promotion gate;
5. never silently reuse the 2025-26 artifact for an unsupported session.

## Guardrails that remain unchanged

The v4 work does **not** change these project rules:

- final enactment into law is not the headline target;
- official legislative sources outrank normalized third-party conflicts;
- probabilities must be empirically evaluated;
- current/floor chamber probability remains member-derived;
- Deep research must remain sourced and inspectable;
- scenarios never mutate official forecasts or training truth;
- production probability changes require a model-promotion gate;
- future information may never leak into historical evaluation or introduction-time prediction.
