# VotePredict scope and deployment alignment — 2026-09-12

## Purpose

This audit was performed immediately after production promotion of the Minnesota 2025-26 introduction-stage model `intro-title-text-eb-v4`.

The review asked two questions:

1. Has the project drifted from the V2 charter/rebuild scope?
2. Do the baseline architecture, evaluation, operations, and deployment documents still describe the product that is actually running?

## Conclusion

**No harmful product-scope drift was found.**

The introduction-stage source-chamber forecast is a legitimate extension of the original chamber-passage mission because it answers a distinct earlier-stage question using the same core principles:

- official legislative sources;
- private-first professional workflow;
- empirically evaluated probabilities;
- leakage-safe historical testing;
- model replaceability;
- explicit provenance;
- no claim to predict final enactment into law.

However, documentation **had drifted behind implementation**. The original charter/architecture described chamber passage almost exclusively as the current/floor member-derived probability. That wording became incomplete once VotePredict added an unconditional source-chamber passage prior assessed at introduction.

The fix is semantic separation, not removal of either product surface.

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

The old mission/forecast-philosophy language implied all passage probabilities should be member-derived. The refreshed charter now explicitly defines both introduction and current/floor targets and narrows the member-derived rule to the current/floor product.

### `docs/ARCHITECTURE_V2.md` — updated

The original single forecast pipeline no longer fully described production. The refreshed architecture adds a separate introduction-time snapshot/frozen-artifact path alongside the current member/evidence/chamber path.

### `docs/EVALUATION_STANDARD.md` — updated

The original standard centered on floor/member forecasting. The refreshed standard now defines target-specific populations, metrics, leakage rules, chronological evaluation, and promotion gates for introduction-stage models while preserving the existing member/floor discipline.

### `docs/OPERATIONS.md` — updated

The old promotion wording implied evaluation and runtime-default change could occur in one reviewed change. The v4 work demonstrated that a safer process is:

1. evaluation/promotion decision;
2. separate serving-artifact/runtime integration;
3. exact-commit deployment and live validation.

The operations document now codifies that staged process.

### `docs/DEPLOYMENT.md` — updated

The refreshed deployment plan incorporates lessons from the v4 rollout:

- exact green `main` SHA is the deployable unit;
- GitHub CI is the default branch validation surface;
- remote Vercel builds are preferred when production secrets are required;
- local `vercel build --prod` must not be trusted when pulled secrets are `[SENSITIVE]` placeholders;
- production release is not complete until READY/SHA/alias/route/5xx/runtime checks pass;
- Vercel deployment quota exhaustion is an explicit operational risk;
- unnecessary previews should be suppressed.

### `README.md` — updated

The implementation summary now names both forecast surfaces and the production introduction model.

### `docs/modeling/source-chamber-introduction-v4.md` — updated

The model document now records the authoritative corpus, serving contract, exact production promotion/deployment identity, and production validation state.

### `docs/DATA_AND_EVIDENCE.md` — reviewed; no rewrite required now

Its official-source hierarchy, provenance rules, historical-version discipline, conflict handling, and source-quality policy remain consistent with the introduction work.

The introduction-specific timing/text-eligibility rules are now governed more precisely by the refreshed charter, architecture, evaluation standard, operations document, and v4 model document. A later data-strategy revision can fold those details into the broader data document if desired, but there is no current contradiction that affects serving behavior.

### `docs/REBUILD_PLAN.md` — reviewed; retain as historical implementation plan

The rebuild plan describes the clean-slate V2 sequence that produced the current product. It should remain useful as historical design provenance rather than being continuously renumbered to match every post-beta model experiment.

The introduction forecast is best treated as a post-foundation evaluated product extension, not evidence that the original rebuild mission changed.

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

### P0 — immediate production confidence

1. Continue normal owner use of `/dashboard/introduction` so the authenticated path receives real production exercise.
2. Review production errors/logs after meaningful authenticated usage, especially `/api/introduction-forecast`.
3. Keep the frozen v4 artifact unchanged unless a new candidate earns promotion.
4. Keep current/floor serving semantics untouched by introduction-stage model work.
5. Verify Vercel project Git settings match the repository's intent to suppress routine feature-branch previews; unexpected previews should be treated as quota leakage.
6. Make PostgreSQL SSL intent explicit before the next major `pg` behavior change.

### P1 — production accountability

1. Add/confirm a production introduction scorecard keyed to `source_chamber_passage`, not individual floor-vote outcomes.
2. Retain introduction forecast/model provenance needed to score current-session predictions later.
3. Surface model/version and forecast-stage language clearly enough that an owner cannot confuse the introduction prior with a floor probability.
4. Add monitoring/operations visibility for the introduction corpus completeness gates where useful.

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
