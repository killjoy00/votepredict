# Introduced-bill lifecycle evaluation program

Status: **active engineering program**  
Tracking issue: #310  
Primary scope: Minnesota Quick / public-data evaluation  
Deep: out of scope

## Why this exists

VotePredict currently evaluates two useful but incomplete endpoints:

1. **Introduction prior** — for every introduced bill, estimate at introduction whether it will eventually pass its originating chamber.
2. **Current/floor forecast** — once a floor-vote target exists, estimate member YEA probabilities and derive chamber passage probability.

The current/floor historical replay is conditional on a bill having reached a passage vote. That is a valid member-vote question, but it is a heavily selected population. It cannot by itself answer the broader question:

> Given everything publicly known at an as-of time, how likely is an introduced bill to advance through the legislative process and ultimately pass its source chamber?

The authoritative 2021-26 introduction corpus contains **31,010 bills**. Only a small fraction ever reach a recorded passage vote. The lifecycle program therefore treats floor access and member voting as separate modeling stages instead of treating the floor-voted subset as the whole legislative universe.

This is a predictive program. Observational evidence can be tested for predictive value; it must not be described as proving that an evidence item caused a legislator's vote or caused a bill to advance.

## Forecast decomposition

The system should model three distinct probabilities.

### A. Lifecycle / floor-access probability

For every introduced bill and every eligible as-of snapshot:

[
P(\text{reaches source-chamber passage vote} \mid \text{public information as of } t)
]

This is estimated over the **complete introduced-bill universe**.

### B. Conditional member support

Only when an actual passage vote supplies an outcome label:

[
P(\text{member votes YEA} \mid \text{passage vote occurs, information as of cutoff})
]

Bills that never receive a passage vote do **not** create member NAY labels. Their member outcomes are unobserved.

### C. End-to-end source-chamber passage

The end-to-end bill probability combines the lifecycle/floor-access process with the conditional chamber model.

Conceptually:

[
P(\text{source-chamber passage}) =
P(\text{reaches passage vote})
\times
P(\text{passes} \mid \text{passage vote})
]

The implementation may use a richer multi-state formulation rather than a literal two-number multiplication, but the conditioning must remain explicit.

The existing introduction prior remains an important baseline for this end-to-end target.

## Primary population and labels

Primary retrospective population:

- all authoritative Minnesota HF/SF bills introduced in 2021-22, 2023-24, and 2025-26;
- 31,010 total introduced bills in the audited introduction corpus;
- primary bill-level outcome: **strict bill-number source-chamber passage during the biennium**.

The strict bill-number outcome remains primary because it is objective and reproducible.

### Companion / omnibus continuation

A bill can fail as a numbered vehicle while related language advances through a companion, substitute, omnibus bill, or another vehicle.

That is important, but it is a **different outcome**.

The program will therefore maintain:

1. **Primary:** strict bill-number source-chamber passage.
2. **Secondary/exploratory:** substantive/vehicle-lineage continuation.

The secondary outcome may not be defined retrospectively by looking at which bills eventually succeeded. Its matching/lineage rule must be frozen from objective text/companion/process information before the outcome score is computed.

## Canonical lifecycle states

The initial state machine is intentionally coarse and source-defensible. It can be refined only after coverage and parser audits.

### State 0 — introduced

Authoritative introduction date exists.

### State 1 — committee/process engagement

At least one dated official source-chamber process action such as:

- committee referral;
- committee report;
- rules referral.

A referral is not automatically called a hearing. We only use the semantics the official source proves.

### State 2 — floor eligibility / scheduling

Dated official actions such as:

- second reading;
- General Orders / Calendar placement;
- special-order/floor scheduling.

### State 3 — source-chamber passage vote reached

An official source-chamber passage vote/action exists.

### Terminal outcomes

- **source-chamber passed**;
- **source-chamber passage vote failed**, where officially observed;
- **session expired without source-chamber passage**.

Other process events remain features/context until they earn a separate state definition.

## Data contract

Every lifecycle row must have an explicit as-of cutoff.

Permitted information is only information provably available before that cutoff.

### Date-granular sources

When the official source proves only a calendar date and not a time of day, an item dated on the target day is excluded from that target snapshot unless ordering is independently provable.

### Mutable current state is forbidden historically

Historical snapshots may not substitute current state for dated state, including:

- current bill title when a dated version is required;
- current companion relationship;
- current sponsor/author list;
- current status;
- later engrossments;
- later evidence/publications.

### Process history

Dated Revisor action history is the initial canonical lifecycle source.

Each source record must retain:

- exact bill;
- session/chamber;
- official action date;
- normalized stage kind;
- original action description;
- source URL;
- content hash / source-document lineage;
- parser version.

## Snapshot design

The first dataset will be **event-time**, not an arbitrary daily expansion.

A bill receives a snapshot at:

- introduction;
- immediately before each eligible lifecycle transition;
- selected fixed elapsed-time landmarks if needed for duration modeling;
- immediately before a source-chamber passage vote where one occurs.

Each snapshot records:

- current lifecycle state;
- days since introduction;
- days since previous transition;
- days remaining in biennium/session where meaningful;
- dated bill-text features;
- dated sponsorship/authorship state where reconstructable;
- dated companion state;
- evidence-family features available by cutoff;
- prior official actions;
- chamber/session context.

This avoids exploding 31,010 bills into unnecessary daily rows while still supporting discrete-time or multi-state survival modeling.

## Modeling sequence

Complexity must earn its place.

### Baseline 0 — frozen introduction prior

Use the accepted introduction model as the unconditional starting benchmark.

### Baseline 1 — empirical stage prior

Estimate future source-chamber passage from:

- current state;
- chamber;
- session/time remaining.

No member evidence.

### Baseline 2 — stage + elapsed-time hazard

Use a discrete-time / event-time transition model for the next lifecycle advancement or terminal expiration.

### Candidate 1 — bill/process features

Add dated bill identity/text and process-history features.

### Candidate 2 — public evidence families

Add the existing Quick Evidence families incrementally and with ablations.

The question is not only whether evidence predicts a member YEA; it may instead predict:

- committee/process advancement;
- floor access;
- scheduling;
- conditional member support.

Those effects must be estimated separately.

### Conditional member/chamber model

Retain a distinct member-level model for actual passage votes.

Committee votes, sponsorship, statements, amendments, and similar observations may be features or auxiliary outcomes. They are not substituted for final floor-vote member labels.

### End-to-end model

Combine lifecycle/floor access with conditional member/chamber passage and score the final source-chamber passage probability across **all introduced bills**.

## Evaluation design

Historical work from this point is development/robustness analysis, not a new independent holdout. We have already inspected outcomes from the historical biennia.

The clean governing confirmation remains prospective 2027-28.

### Retrospective chronology

Use chronological fitting:

- 2021-22: earliest development/training;
- 2023-24: later validation/development;
- 2025-26: later descriptive/robustness period.

Do not characterize these already-inspected periods as a newly untouched test set.

### Bill-level primary metrics

Across all introduced bills:

- Brier score;
- log loss;
- calibration / ECE;
- average precision for rare positive outcomes;
- calibration by probability band;
- House/Senate and session slices.

### Lifecycle metrics

For floor access and intermediate transitions:

- Brier/log loss for transition probability;
- calibration;
- precision-recall where transitions are rare;
- state-conditioned performance;
- elapsed-time / time-remaining slices;
- coverage and censoring diagnostics.

### Conditional member metrics

Only on actual observed member passage votes:

- Brier;
- log loss;
- calibration;
- call accuracy where interpretable;
- event-balanced summary;
- chamber-balanced summary;
- House/Senate slices;
- moved-member / evidence-rich slices.

### Conditional chamber metrics

- passage Brier/log loss;
- expected Yes-count MAE;
- interval coverage;
- House/Senate slices;
- close/non-close vote slices.

### End-to-end metrics

The decisive retrospective question is whether the combined system improves source-chamber-passage probability across the full introduced-bill universe relative to the accepted introduction prior and simpler lifecycle baselines.

## Missingness and selection

Missing process information is not silently treated as "nothing happened."

The pipeline must report:

- process-source coverage;
- parser coverage;
- unclassified dated action counts;
- bills with no action history beyond introduction;
- date inconsistencies;
- source failures/exclusions;
- reconciliation with known passage votes and session expirations.

The member-vote dataset remains explicitly selected/conditional. The lifecycle dataset exists in part to model that selection rather than ignore it.

## Promotion policy

No retrospective lifecycle result automatically changes serving Quick.

A serving change requires:

1. a frozen model/configuration;
2. leakage-safe reproducible data;
3. comparison with the accepted introduction/current-floor baselines;
4. understood chamber/stage slices;
5. no material unresolved data-coverage issue;
6. separate reviewed runtime integration;
7. prospective confirmation when required.

The 2027-28 lifecycle snapshots should be captured under the frozen contract before outcomes accrue.

## Execution infrastructure

Bulk historical research must not run inside Vercel production functions.

Use this separation:

- **Vercel:** serving application, lightweight production endpoints, forecast scheduler, and only ingestion that truly requires the deployed application boundary.
- **GitHub Actions:** bounded historical crawls, corpus reconstruction, offline evaluation, research artifacts, and heavy prospective ingestion that can safely execute as ordinary Node/database work.
- **Neon:** canonical production/research data store. Historical GitHub jobs may write directly through the production database connection when the operation is explicitly idempotent, source-lineaged, bounded, and covered by verification queries.
- **Deep historical workflows:** manual-only while Deep remains out of scope.
- **Completed historical backfills/evaluations:** manual-only. Production deploys must not retrigger them.

The lifecycle Revisor backfill is the reference pattern: GitHub Actions reads the database credential privately, executes the existing parser/backfill code on the runner, uses low external-source concurrency, records transient failures as retryable deferrals, and verifies corpus coverage after each bounded chunk. It does not invoke a Vercel function.

The prospective public-evidence refresh follows the same execution boundary: its six-hour rotation, source collection, structured-public refresh, campaign-finance refresh, and durable evidence writes run on GitHub Actions directly against Neon. The production route remains available as an emergency/manual surface, but scheduled ingestion does not consume Vercel function CPU.

This boundary is both a cost control and a reliability rule. Production function CPU/memory limits must not determine whether an offline historical corpus can be reconstructed.

## Execution plan

### P0 — contract and inventory

- [x] Define the lifecycle target decomposition and evaluation rules.
- [x] Identify the current selection problem in the floor-vote-only replay.
- [x] Reuse the 31,010-bill authoritative introduction universe as the population contract.
- [ ] Record reproducible baseline counts for lifecycle source coverage.

### P1 — full-universe process history

- [ ] Expand dated Revisor process-history ingestion from passage-voted bills to all introduced bills.
- [ ] Derive official status API URLs when historical bill rows do not already store one.
- [ ] Keep network ingestion bounded/retryable and source-hash-backed.
- [ ] Reach the frozen process-source coverage gate or explicitly document exclusions.

### P2 — process/history audit

- [ ] Report stage-kind counts by session/chamber.
- [ ] Audit unclassified official actions before expanding the taxonomy.
- [ ] Reconcile process passage actions with authoritative source-chamber outcomes.
- [ ] Audit impossible dates and post-terminal events.
- [ ] Freeze the canonical state derivation.

### P3 — lifecycle snapshot dataset

- [ ] Build immutable event-time snapshots for every introduced bill.
- [ ] Enforce strict cutoff eligibility in code/tests.
- [ ] Represent terminal expiration without manufacturing member-vote labels.
- [ ] Freeze dataset schema/version and lineage.

### P4 — lifecycle baselines

- [ ] Score the frozen introduction prior on the exact lifecycle population.
- [ ] Fit stage-only empirical baseline.
- [ ] Fit stage + elapsed-time hazard baseline.
- [ ] Compare with chronological forward-chaining.

### P5 — evidence allocation

- [ ] Test evidence families against the lifecycle stage(s) they can plausibly predict.
- [ ] Keep floor-vote member scoring separate.
- [ ] Run family ablations and chamber/state slices.
- [ ] Do not describe predictive associations as causal effects.

### P6 — end-to-end combination

- [ ] Combine floor-access/lifecycle probability with conditional member/chamber passage.
- [ ] Score strict source-chamber passage across all introduced bills.
- [ ] Compare directly with the introduction prior and simpler lifecycle baselines.

### P7 — secondary vehicle/companion outcome

- [ ] Define an outcome-blind text/companion lineage rule.
- [ ] Freeze it before joining final outcome labels.
- [ ] Report it separately from strict bill-number passage.

### P8 — 2027 prospective validation

- [ ] Activate lifecycle snapshots before 2027-28 outcomes.
- [ ] Preserve the serving models while observations accrue.
- [ ] Score only after frozen prospective gates are met.
