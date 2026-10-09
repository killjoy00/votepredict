# Prospective forecast-quality readiness — offline checkpoint (2026-10-09)

Scope: owner-approved next step after pausing the 2021–22 historical directional-evidence search, tracked separately in [#718](https://github.com/killjoy00/votepredict/issues/718). This is a **checked-in-code / issue-document readiness audit**, not a production health check, live-credential test, prospective activation, model build, or prediction score.

## Readiness matrix

| Area | Verified from repository | What is still required |
| --- | --- | --- |
| Current/floor Quick baseline | Frozen serving default `member-eb-v1.2-decay180`; [#287](https://github.com/killjoy00/votepredict/issues/287) governs subsequent comparisons. | Keep model stable; capture truly as-of prospective Quick revisions and official outcomes before making effectiveness claims. |
| Quick Evidence shadow | Frozen `data/evaluation/quick-evidence-prospective-plan-v1.json`; `src/forecasting/quick-evidence-shadow.ts`, `src/operations/quick-evidence-prospective-scorecard.ts`, and `tests/quick-evidence-prospective-lifecycle.integration.test.ts` implement/test non-serving member-vector capture, resolution and sealed scoring on disposable local PostgreSQL. | The primary paired scorecard requires **40 resolved forecasts, 2,000 member outcomes and 50 members with recorded directional candidate items as currently counted by the code**; live capture volume is *not verified here*. |
| Introduction model | Accepted introduction-only `intro-title-text-eb-v4`, described in `docs/modeling/source-chamber-introduction-v4.md`. | Maintain the complete introduced-bill population; do not substitute selected-floor probability for an introduction forecast. |
| Lifecycle model | [#310](https://github.com/killjoy00/votepredict/issues/310) froze P8 model under `lifecycle-p8-prospective-plan-v1` on completed 2021–26 data; `src/evaluation/lifecycle-p8-prospective.ts` pins model/plan/upstream hashes. | **Immutable daily 2027–28 lifecycle capture remains an unchecked operational gate**, not something to switch on in this readiness audit. |
| Lifecycle scoring | P8 explicit date-exclusive event-time selection; no synthetic member NAY outcomes for non-floor-voted bills. Scoring sealed until **2028-07-01T00:00:00Z**, complete labels and coverage gates (intro >=95%, daily lifecycle >=90%, process source >=95%). | No early effectiveness claims or model promotion. |
| Production & Vercel | [#732](https://github.com/killjoy00/votepredict/issues/732) pauses automatic deployments, runtime forecast scheduling, evidence refresh and live smoke. Vercel's previously deployed cron is **unverified**, not established disabled. | Separate owner-approved release/operational plan, budget and source readiness verification before any production Vercel or DB connection. |
| Historical evidence | [#718](https://github.com/killjoy00/votepredict/issues/718) paused: 2021–22 strict directional baseline **9 / 35,510**. | Do not reopen bulk audio, old House member-news/Wayback, or retrospective feature fitting on already-inspected outcomes. |

## Independent freeze-artifact verification

Downloaded the original [P8 model-freeze run 35910925882](https://github.com/killjoy00/votepredict/actions/runs/35910925882) artifact **10772991611** and independently rehashed the actual ZIP bytes: `sha256:72a42063a028114b4f6cbd8a356e74940eb00bdcda28a83cadf884aaa346061e` (matches the recorded immutable reference). Parsed its embedded `model.json` and recomputed `SHA256(JSON.stringify(modelContent))`: `abcf583153939d46aa021dccf2afe61d698ad4538a981059cdee265c03166a65` (matches `summary.json` and code-pinned frozen model content). `preActivation` in that **September 23, 2026 artifact** is zero bills, outcomes, revisions, votes and stage events; this does **not** establish the live production counts on October 9. The artifact's policy forbids target-session outcome fitting and automatic promotion, preserves `member-eb-v1.2-decay180`, and keeps the 2028-07-01 reveal date.

## Frozen Quick sample-gate interpretation caveat

The frozen Quick plan labels its third threshold `minimumMembersWithAppliedDirectionalEvidence: 50`. Current scorecard implementation in `src/operations/quick-evidence-prospective-scorecard.ts` counts distinct membership IDs where `features.candidateEvidenceItems > 0`; it does **not** require `candidateProbability` to differ from `servingProbability`. Thus the 50 count represents members with directional candidate items under current code, **not necessarily 50 moved member probabilities**. Separate moved-member metrics exist. This is a verified terminology/interpretation limitation, not evidence that any actual prospective cohort has been mis-scored. **Do not silently alter the already-frozen gate**: confirm intended semantics with #287's prospective protocol before interpreting the threshold or approving a promotion.

## Actual blocking workflow exception corrected

The first repository-only pass found **two** existing Vercel-credential workflows outside the earlier 15-item static pause allowlist:

- `.github/workflows/evidence-2027-readiness-audit.yml`, previously runnable by a specially prefixed owner issue comment on #287/#579 and able to execute `vercel env pull --environment=production`;
- `.github/workflows/lifecycle-p8-prospective-model.yml`, previously runnable by a specially prefixed owner comment on #310 and by unrestricted manual dispatch; it also pulls the production environment before rebuilding a P8 research artifact.

A comment-prefix check is **not** the same as a standalone affirmative Vercel-cost/credential approval. Both workflows are now `workflow_dispatch`-only, with a required boolean `run_vercel` default **false** and the exact job gate `inputs.run_vercel == true && github.ref == 'refs/heads/main'`. They are **not run in this audit**. No existing Vercel secret, URL, DB credential, or production model is changed.

The repository-only `src/operations/evidence-operating-posture.ts` now fail-closes on all **17** paused Vercel-consuming workflows rather than 15. The deterministic tests assert refusal when either prospective workflow regains an issue-comment trigger, defaults to true, omits its explicit approval flag, or drops its main-branch requirement. Full normal CI uses only disposable GitHub-hosted PostgreSQL and local code/tests; it must pass on the exact PR head and after merge.

This is a **bounded fix for these two verified paths**, not a claim that every possible workflow, external cron or live Vercel configuration was audited.

## Next work, ranked by effect on defensible prediction assessment

1. **Protect the baseline and frozen protocols** (this correction plus normal CI). No new model fit, evidence retrieval, or retrospective tuning. The existing combined Quick Evidence historical result improved member Brier while worsening chamber-passage Brier beyond its declared gate; P6 similarly regressed on 2025–26 versus retained P5.
2. **Verify operational prerequisites as a separate approval step before any 2027 data capture**: resolve the live cron question under #732 without triggering costly functions, design strictly bounded 2027 data ingestion/capture, ensure immutable as-of retention and official resolution, and establish a real production cost/permissions budget.
3. **Accumulate clean prospective outcomes first.** Track capture/source coverage and missed/failing revisions without opening performance metrics early; score Quick versus shadow only after #287's frozen 40/2,000/50 gate. For P8, preserve the 2028 reveal gate and its three separate coverage thresholds.
4. **Evaluate only on the right target and population**: introduction v4 on all introduced bills; lifecycle P4/P5/P6 on eligible event-time all-bill snapshots; Quick member/chamber on genuine passage votes. Investigate chamber-level calibration before allowing member-level evidence improvements to move serving traffic.
5. **Promote nothing automatically.** Material chamber-passage regressions veto an evidence candidate even if member metrics improve. Any promotion requires an independently approved frozen protocol and explicit production release.

## Verification limits

No GitHub issue comment was used to trigger any prospective workflow. No Vercel API/production route, database, secrets, outside office, transcript, public-site scrape, feature store or model was accessed or changed. This checkpoint does **not** assert that live source feeds, production forecasts, cron removal, P8 daily capture, or prospective sample thresholds are currently ready. The only operational changes proposed are two default-off GitHub workflow guards and the deterministic static audit protecting them.
