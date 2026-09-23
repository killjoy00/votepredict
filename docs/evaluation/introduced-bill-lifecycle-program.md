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

- **Vercel:** serving application, lightweight production endpoints, forecast scheduler, and genuinely prospective ingestion that needs the deployed application boundary.
- **GitHub Actions:** bounded historical crawls, corpus reconstruction, offline evaluation, and research artifacts.
- **Neon:** canonical production/research data store. Historical GitHub jobs may write directly through the production database connection when the operation is explicitly idempotent, source-lineaged, bounded, and covered by verification queries.
- **Deep historical workflows:** manual-only while Deep remains out of scope.
- **Completed historical backfills/evaluations:** manual-only. Production deploys must not retrigger them.

The lifecycle Revisor backfill is the reference pattern: GitHub Actions reads the database credential privately, executes the existing parser/backfill code on the runner, uses low external-source concurrency, records transient failures as retryable deferrals, and verifies corpus coverage after each bounded chunk. It does not invoke a Vercel function.

This boundary is both a cost control and a reliability rule. Production function CPU/memory limits must not determine whether an offline historical corpus can be reconstructed.

## Execution plan

### P0 — contract and inventory

- [x] Define the lifecycle target decomposition and evaluation rules.
- [x] Identify the current selection problem in the floor-vote-only replay.
- [x] Reuse the 31,010-bill authoritative introduction universe as the population contract.
- [x] Record reproducible baseline counts for lifecycle source coverage.

### P1 — full-universe process history

- [x] Expand dated Revisor process-history ingestion from passage-voted bills to all introduced bills.
- [x] Derive official status API URLs when historical bill rows do not already store one.
- [x] Keep network ingestion bounded/retryable and source-hash-backed.
- [x] Reach the frozen process-source coverage gate or explicitly document exclusions.

### P2 — process/history audit

- [x] Report stage-kind counts by session/chamber.
- [x] Audit unclassified official actions before expanding the taxonomy.
- [x] Reconcile process passage actions with authoritative source-chamber outcomes.
- [x] Audit impossible dates and post-terminal events.
- [x] Freeze the canonical state derivation.

The reproducible audit entry point is `npm run audit:lifecycle:p2`. Production-data execution uses the manual
`Lifecycle P2 audit` GitHub Action, which pulls the production environment privately, connects directly to Neon,
writes `artifacts/lifecycle-p2-audit.json`, and never invokes a Vercel application function. The default mode enforces
the frozen coverage/date/passage gates; report-only mode is allowed while corpus reconstruction is incomplete.

`revisor-process-v2` stores a separate `revisor-process-audit-v1` marker and bounded action-audit metadata so P2 can
report unclassified dated actions without refetching the entire source corpus. Introduction actions, source-chamber
passage/failure actions, process-classified actions, and other dated actions remain distinct categories. Explicit failed
source-chamber passage votes without a synthetic expiration row are reported for terminal-state policy review rather
than treated as unexplained missing terminal evidence.

Frozen P2 result (2026-09-23): enforced run `35878777102` passed on the 31,010-bill population with
30,964 parsed/audited bills (99.8517% parser coverage), 46 source-deferred bills after a deliberate confirmation
retry, zero permanent exclusions, zero v2 pre-introduction events, zero post-expiration events, zero passage-label
mismatches, and zero hard gate failures. The retained review flags are descriptive rather than gate failures:
26,418 dated official actions remain outside the initial process taxonomy, 3,188 process events occur after
source-chamber passage, and 11 authoritative non-passages have an explicit failed source-chamber vote instead of a
synthetic expiration row. The frozen audit artifact is `lifecycle-p2-audit-v1` using
`revisor-process-v2` + `revisor-process-audit-v1`.

### P3 — lifecycle snapshot dataset

- [x] Build immutable event-time snapshots for every introduced bill.
- [x] Enforce strict cutoff eligibility in code/tests.
- [x] Represent terminal expiration without manufacturing member-vote labels.
- [x] Freeze dataset schema/version and lineage.

P3 is implemented as a read-only artifact builder. The frozen initial schema is
`lifecycle-p3-snapshot-v1` / `mn-2021-2026-event-time-v1`. Every feature row uses an explicit
calendar-date-exclusive cutoff: same-day source items are excluded when ordering is not independently provable.
The snapshot schema separates cutoff-safe `features` from future `targets`, keeps member-vote labels null for the
all-bill lifecycle population, and records process/source lineage. Production-data execution is manual-only through
the `Lifecycle P3 snapshot dataset` GitHub Action and writes an immutable manifest plus NDJSON snapshots; it does
not write to Neon or change serving behavior.

Frozen P3 result (2026-09-23): production-data run `35884352014` on code SHA
`68e80e8848d6e5e4e91b1132b88a04aac82ccdc0` produced **63,974** snapshots over all **31,010** frozen bills.
Process-parser coverage remained **30,964 / 31,010 (99.8517%)**, with the same 46 source-deferred bills retained as
explicit missing process history rather than silently interpreted as no action. The terminal bill outcomes are
30,345 session expirations without source-chamber passage, 11 observed source-chamber passage-vote failures without
a synthetic expiration row, and 654 source-chamber passages. The snapshot-content SHA-256 is
`45030a9780ce76690ea960605385f501c24047b461a82e1368a427a7267be39d`; the uploaded GitHub artifact digest is
`sha256:8dfa18fc6734a45f9a0b25ba7a77a76d42ce7a5f5ebda8aaae8e6bd35b92c576`.

The artifact contains 54,912 snapshots with a strictly cutoff-eligible dated bill-text version and 1,963 snapshots
with reconstructable dated authorship. It contains **zero** cutoff-eligible external-evidence snapshots under the
initial fail-closed rule requiring both durable-source fetch availability and publication availability before the
historical cutoff. P5 may only change that zero after a source-specific historical-availability rule is separately
proved and frozen; current/mutable evidence may not be retroactively treated as historically available.

### P4 — lifecycle baselines

- [x] Score the frozen introduction prior on the exact lifecycle population.
- [x] Fit stage-only empirical baseline.
- [x] Fit stage + elapsed-time hazard baseline.
- [x] Compare with chronological forward-chaining.

The reproducible P4 evaluator is `npm run eval:lifecycle:p4` and the manual-only
`Lifecycle P4 baselines` GitHub Action. It first rebuilds P3 read-only and refuses to score unless the snapshot
content SHA-256 exactly matches the frozen P3 hash. The accepted `intro-title-text-eb-v4` model family is evaluated
with the already-frozen chronological contract (2023-24 from 2021-22; 2025-26 from completed earlier biennia), then
carried forward unchanged as the benchmark prior at later lifecycle snapshots. Its pre-existing introduction input
contract is not imported into P3 features. The lifecycle stage baseline uses only source chamber + canonical state.
The elapsed-time baseline is a separate 30-day discrete **process-progression** hazard over risk sets beginning the
day after a known transition. Session expiration is treated as a competing terminal clock and reported separately:
including the synthetic expiration event in the same binary hazard makes days-remaining nearly deterministic near
sine die and would overstate legislative-process predictability. The first exploratory combined-event P4 run
(35887005599) demonstrated that failure mode and is superseded by the competing-risk formulation before P4 is
frozen. P4 is research-only and cannot change serving behavior.

Frozen P4 result (2026-09-23): run `35888230161` on code SHA
`1eac79a2afba0aadeb6c94522335d5586f396e33` produced the accepted
`lifecycle-p4-baselines-v2` artifact against the exact frozen P3 snapshot hash. The forward-chained holdouts contain
21,495 bills and 44,299 event-time snapshots. The 2025-26 v4 introduction predictions match the frozen serving
artifact exactly (maximum delta 0).

For eventual source-chamber passage across all holdout event-time snapshots, the immutable accepted introduction
prior has Brier **0.0296529**, log loss **0.133532**, ECE **0.0119768**, AP **0.195297**, and ROC-AUC **0.779445**.
The chamber+state empirical lifecycle baseline improves the proper probability scores to Brier **0.0269373**, log
loss **0.119133**, and ECE **0.00283910**, while ranking falls to AP **0.165479** and ROC-AUC **0.688442**. At the
introduction snapshot itself, v4 remains better on Brier/log loss and ranking; the lifecycle gain appears after
process state becomes known, especially at floor-eligibility/scheduling where the observed passage rate is 34.3%.
This is therefore evidence that coarse state is useful for probability updating, not evidence that the stage-only
baseline should replace the accepted introduction model.

For 30-day **process-progression** risk sets, stage-only yields Brier **0.00756840**, log loss **0.0428658**, AP
**0.0256413**, and ROC-AUC **0.633180**. Adding elapsed-time + days-remaining buckets improves Brier to
**0.00707792**, log loss to **0.0329923**, AP to **0.129082**, and ROC-AUC to **0.910342** across both later
biennia. The separate expiration-clock diagnostic confirms why it must remain a competing terminal outcome:
21,025 of 22,043 risk rows with <=30 days remaining terminate by session expiration, versus zero expiration positives
outside that bucket. The earlier combined-event run `35887005599` is superseded and is not a P4 result.

Frozen prediction digests are passage
`3f64819a302de71e2d70bc5ea0f972ab1b00cf09819bdf029ce30b3f979624c7` and progression hazard
`416d4da8c8bf159a03893499b077e2617c662cfa3368b2f728224157746a13f4`. The GitHub artifact digest is
`sha256:e13fa73dc2e8d239e187d307b0b8cf6da024ce0c9152ca8f9ad7aab611fd8a42`.

### P5 — evidence allocation

- [ ] Test evidence families against the lifecycle stage(s) they can plausibly predict.
- [ ] Keep floor-vote member scoring separate.
- [ ] Run family ablations and chamber/state slices.
- [ ] Do not describe predictive associations as causal effects.

P5 is a forward-chained ablation study over the exact frozen P3 snapshot hash. The first retrospective allocation
tests only families whose historical cutoff availability is proved by P3: dated process detail, dated companion
references, strictly pre-cutoff bill-version/text structure, and reconstructable dated authorship. The durable
external-evidence layer (finance, campaign/member-primary material, news, and other later-fetched evidence) remains
**prospective-only** for lifecycle evaluation unless a source-specific historical-availability rule is separately
proved and frozen; P3 currently contains zero cutoff-eligible external-evidence snapshots.

The stage-specific outcomes are (1) eventual reach of floor eligibility/scheduling while the bill is still earlier
in the lifecycle, (2) eventual reach of a source-chamber passage vote, and (3) strict bill-number source-chamber
passage. Each candidate is compared with a matched source-chamber + canonical-state + elapsed-time + days-remaining
empirical baseline using only earlier completed biennia. This explicit clock control is required because the first
exploratory P5 run (35891414803) showed that process depth and bill-version availability can partly proxy elapsed
time when compared only with chamber + coarse state; that v1 run is superseded before P5 is frozen. P5 uses low-dimensional family summaries rather than member IDs, specific companion
identities, text hashes, or outcome-derived labels. Authorship is a matched-subset analysis because unreconstructable
authorship is not treated as predictive missingness. The full-coverage core combination is process detail +
companion + bill-version structure, with single-family and leave-one-family-out ablations. Conditional member-vote
scoring remains outside P5. All associations are descriptive/predictive, not causal, and no P5 result can
automatically change serving behavior.

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
