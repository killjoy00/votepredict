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

- [x] Test evidence families against the lifecycle stage(s) they can plausibly predict.
- [x] Keep floor-vote member scoring separate.
- [x] Run family ablations and chamber/state slices.
- [x] Do not describe predictive associations as causal effects.

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

Frozen P5 result (2026-09-23): time-controlled run `35892309907` on code SHA
`366b55ee6d862662ca81862f22be6150450cbf3b` produced the accepted
`lifecycle-p5-evidence-allocation-v2` artifact against the exact frozen P3 hash. The earlier v1 screening run
`35891414803` is superseded because it did not explicitly control the matched baseline for elapsed time and time
remaining.

The time-controlled allocation is:

- **Dated process detail:** retain as a development feature primarily for floor-access/process-state updating. On
  reach-floor-eligibility it improves Brier by **0.0000530**, log loss by **0.001938**, ECE by **0.000427**, AP by
  **0.000590**, and ROC-AUC by **0.00321** versus its matched clock-controlled baseline. The proper-score improvement
  is present in both later biennia and both chambers, but its incremental effect on final passage is much smaller
  and some final-stage slices regress. It is not treated as a standalone final-passage model.
- **Cutoff-eligible bill-version/text structure:** retain as a development floor-access feature. On
  reach-floor-eligibility it improves Brier by **0.0001079**, log loss by **0.001216**, ECE by **0.001006**, AP by
  **0.02605**, and ROC-AUC by **0.00436**; the proper-score gains are present in both later biennia and both chambers.
  Final-passage improvements are much smaller and mixed by state.
- **Companion references:** do not carry as a historical lifecycle feature. Only **2** frozen snapshots have a dated
  pre-cutoff companion reference, and the companion-only candidate is effectively flat or worse on vote-reach and
  strict-passage metrics.
- **Authorship:** do not carry as a full-universe historical feature. Only **1,963 / 63,974 (3.07%)** snapshots are
  reconstructable; the holdout subset covers just **462** bills and is severely selected (all eligible floor-access
  and vote-reach rows are positive, with 97.8% strict-passage prevalence). That subset cannot support a general
  historical lifecycle allocation.
- **Durable external evidence:** remains prospective-only. The frozen P3 dataset has **0** historically
  cutoff-eligible external-evidence snapshots, so finance/news/campaign/member-primary families are not
  retrospectively scored or backfilled from later fetches.

The retained P6 development arm is therefore the time-controlled baseline plus **process detail + bill-version
structure**, excluding companion, authorship, and later-fetched external evidence. In the leave-companion-out
ablation this arm improves reach-floor-eligibility Brier from **0.03178835** to **0.03168134**, log loss from
**0.13257067** to **0.13059783**, ECE from **0.00226851** to **0.00132585**, AP from **0.554180** to **0.578575**,
and ROC-AUC from **0.853490** to **0.859209**. On strict source-chamber passage it produces only a modest
development association: Brier **0.02084032 -> 0.02082469**, log loss **0.08797481 -> 0.08737849**, AP
**0.437933 -> 0.444600**, and ROC-AUC **0.866162 -> 0.873807**, while ECE worsens
**0.00403345 -> 0.00451352**. P6 must therefore score the end-to-end combination rather than infer a serving
improvement from this component screen.

The retained arm prediction digest is
`ed877b070c9f2b93da30e30482869ad5adc7c4f32f28ab6ae481d513a1f66c0e`; the P5 artifact digest is
`sha256:5d398244a40a86c0a838facef61759203b28ee2a6fdc9cac5bc5caf25f2b0d77`.

P5 does not retrofit these families onto the P4 30-day hazard landmarks because P3 v1 freezes family availability
at event-time cutoffs, not at arbitrary intervening daily landmarks. Filling those daily family states from later
snapshots would violate the as-of contract.

### P6 — end-to-end combination

- [x] Combine floor-access/lifecycle probability with conditional member/chamber passage.
- [x] Score strict source-chamber passage across all introduced bills.
- [x] Compare directly with the introduction prior and simpler lifecycle baselines.

P6 freezes the decomposition before inspecting its end-to-end result:

`P(strict source-chamber passage) = P(reach source-chamber passage vote) × P(pass that chamber vote | current information)`.

The lifecycle arm is the P5-retained time-controlled process-detail + bill-version candidate for
`reach_source_chamber_passage_vote`. The conditional arm replays the promoted serving default
`member-eb-v1.2-decay180`: active historical roster, 180-day-decayed member passage history, prior chamber/party
history, strictly pre-cutoff substantive analogues, and the existing member-derived chamber simulation. Same-biennium
prior floor votes are allowed only when strictly earlier than the event-time cutoff, matching information that would
have been public then.

P6 is required to score the complete later-biennium introduced-bill population. When the member-derived floor model
cannot be replayed safely at a historical cutoff (for example no strictly prior usable bill text or no direct member
vote on the selected analogues), the conditional term falls back explicitly to the source chamber's empirical
passage rate from passage votes strictly earlier than the cutoff. When a bill is one of the frozen process-deferred
cases and therefore has no leakage-safe P5 reach-vote row, the end-to-end candidate retains the P4 direct stage
probability instead of interpreting missing process history as no advancement.

Before scoring, P6 must reproduce three upstream contracts exactly: the P3 snapshot SHA-256, the frozen P4 passage
prediction digest, and the frozen P5 retained-arm digest. It reports member-derived conditional coverage separately,
scores the conditional chamber component at actual passage-vote cutoffs, and compares the end-to-end probability
with the accepted introduction prior, P4 stage-only baseline, and P5 direct-passage arm on identical observations.
This remains retrospective development/robustness work; no result can automatically change serving behavior.

Frozen P6 result (2026-09-23): run `35895940041` on code SHA
`576ea1cc793e471822951eef8b0bc08cf8b62986` produced
`lifecycle-p6-end-to-end-v1` after reproducing all three upstream gates exactly:

- P3 snapshot SHA-256
  `45030a9780ce76690ea960605385f501c24047b461a82e1368a427a7267be39d`;
- P4 passage-vector SHA-256
  `3f64819a302de71e2d70bc5ea0f972ab1b00cf09819bdf029ce30b3f979624c7`;
- P5 retained-arm SHA-256
  `ed877b070c9f2b93da30e30482869ad5adc7c4f32f28ab6ae481d513a1f66c0e`.

The later-biennium scoring population is **21,495 bills / 44,299 event-time snapshots**. The lifecycle decomposition
is available on **44,235** rows covering **21,463** bills; the remaining 64 rows / 32 process-deferred bills retain
the P4 direct-stage probability rather than treating missing process history as no advancement. The promoted
`member-eb-v1.2-decay180` conditional chamber model is replayable on **39,905 / 44,299 (90.1%)** rows. The
4,394 explicit conditional fallbacks consist of 4,382 rows without strictly pre-cutoff usable target text, 8 without
safe analogues, and 4 without direct active-member analogue support. Member-derived conditional coverage is 79.6%
while the bill is still in the introduced state and above 99.9% after committee engagement.

At the **467 actual source-chamber passage-vote cutoffs** (457 passed, 10 failed), the accepted member-derived
conditional model is available on 465. It has more ranking discrimination than the earlier-vote chamber passage-rate
prior (AP **0.99269 vs 0.98706**, ROC-AUC **0.71028 vs 0.60066**) but materially worse proper probability scores and
calibration (Brier **0.02884 vs 0.02102**, log loss **0.13492 vs 0.10593**, ECE **0.05853 vs 0.01010**). The slice
diagnostic matters: the member model beats the prior on House Brier/log loss, while all 123 Senate cutoff votes in
this cohort pass and the near-one prior therefore dominates there. This is evidence that the conditional model
contains discrimination signal but is underconfident relative to the extremely high selected pass rate; it does not
justify replacing the accepted serving member model from this retrospective cohort.

Across **all 44,299 event-time snapshots**, the P6 evidence decomposition modestly improves the strongest P5
direct-passage arm: Brier **0.02083876 -> 0.02072180**, log loss **0.08746306 -> 0.08714066**, AP
**0.44401 -> 0.47265**, and ROC-AUC **0.87341 -> 0.87888**, while ECE worsens
**0.00452173 -> 0.00556200**. It also substantially improves the P4 stage-only and immutable introduction-prior
scores once later process states are included.

That aggregate lift is **not stable enough for promotion**. In 2023-24 the P6 evidence decomposition improves P5
Brier (**0.01795661 -> 0.01760599**) and log loss (**0.07681186 -> 0.07582757**), but in 2025-26 it regresses both
Brier (**0.02388678 -> 0.02401691**) and log loss (**0.09872721 -> 0.09910479**). At the introduction snapshot
itself, the accepted v4 prior remains clearly better: v4 Brier/log loss are **0.02060092 / 0.09802744** versus
P6 **0.02083770 / 0.10328141**, with much stronger ranking (AP **0.16436 vs 0.02618**, ROC-AUC
**0.78224 vs 0.56018**). P6 therefore does not replace the introduction model.

The frozen P6 prediction SHA-256 is
`3dd4f37ce0433311d88a978f9d6081570b62a5dc0e66996f569acfa1b174e795`; the GitHub artifact digest is
`sha256:8eb07292132743a0894ba7d42433760cf341bd66484105191027c73243d5709c`.

**P6 conclusion:** the lifecycle × conditional-chamber decomposition is technically valid and adds useful
development signal after bills advance, but the current retrospective result does not clear a serving-change bar:
the conditional probability is miscalibrated on the highly selected passage-vote cohort, the incremental end-to-end
lift over P5 is small and reverses in 2025-26, and v4 remains superior at introduction. Production action remains
**none**; 2027-28 prospective confirmation remains governing.

### P7 — secondary vehicle/companion outcome

- [x] Define an outcome-blind text/companion lineage rule.
- [x] Freeze the production lineage artifact before joining final outcome labels.
- [x] Report the frozen secondary outcome separately from strict bill-number passage.

P7 v1 deliberately starts with the narrowest high-precision lineage contract that can be reproduced without reading
a passage result. The fixed population remains the 31,010 P3 bills and the relationship horizon is the same biennium.
The lineage builder is read-only and may inspect only bill identity/chamber/session, final official companion metadata,
dated `revisor-process-v2` companion-reference actions plus their source-document hashes, and dated official bill
text versions. It does **not** read `sourceChamberPassage`, `vote_events`, `member_votes`, forecast outcomes, or
any other success/failure label.

An undirected P7 v1 relationship edge is admitted only by at least one outcome-independent proof:

1. a dated official Revisor action explicitly records substitution of the other bill;
2. a dated official Revisor action explicitly calls the other bill a companion;
3. final official Revisor companion metadata is reciprocal within the same biennium **and both directions retain
   the official status source URL plus content hash**; or
4. a source-lineaged official text version has an exact canonical substantive-text hash shared by exactly two bills
   in that biennium and those bills originate in opposite chambers.

A bare `comparison with` action is retained as audit evidence but is not sufficient by itself because official
history can later state that compared bills are not identical. One-sided final companion metadata, reciprocal
metadata without frozen source/hash lineage, and unlineaged dated relationship rows are likewise audit evidence
unless another accepted proof corroborates the pair. Exact-text groups spanning more than two bills and same-chamber
duplicates remain visible and unresolved rather than being forced into pairwise lineage.

P7 v1 explicitly excludes fuzzy/near-identical thresholds, title similarity, omnibus section containment, and
cross-biennium reintroduction/successor inference. Those evidence classes require separately frozen precision and
time-horizon contracts; omitting them produces false negatives rather than post-hoc successful-vehicle matches. This
means P7 v1 is a high-precision secondary outcome, not a claim of complete substantive-policy tracing.

Final/current companion metadata is permitted only for retrospective **label lineage** after the biennium. It never
becomes an event-time historical feature. Any dated relationship used prospectively remains subject to the existing
date-exclusive chronology rule; same-day evidence cannot be moved before a forecast cutoff when ordering is
unproved.

P7 outcome closure is **direct-edge only**. Connected components are emitted for audit, but transitive connectivity
does not by itself make two bills substantive vehicles for one another. This is required because a bill can acquire
different exact-text counterparts across different versions over time; automatically taking graph transitive closure
would merge those distinct version relationships. A P7 outcome may therefore inspect the bill itself plus only bills
joined to it by a direct accepted edge.

The frozen secondary label is **`substantive_vehicle_passage_v1`**. A bill is positive only when either (a) its
own strict bill-number source-chamber passage label is positive, or (b) at least one **direct accepted P7 v1 lineage
neighbor** has a positive strict bill-number source-chamber passage label in the same biennium. Unmatched bills
therefore reduce to their own strict label. Audit-only connected components do not expand the label transitively.
This is a vehicle-lineage outcome, not a claim that every provision passed intact and not a causal attribution.

Frozen P7 lineage result (2026-09-23): production-data run `35902569738` on code SHA
`519511f67326a35386cf488694aafee980733556` produced the hardened
`lifecycle-p7-lineage-v1` artifact without reading passage/vote outcomes. It contains **13,508 direct accepted
House-Senate edges** linking **27,011 / 31,010 bills**, with **3,999 unmatched bills**. There are 13,503 connected
audit components; four components contain 3-4 bills because distinct bill versions can create different direct
counterparts, which is why outcome closure remains direct-edge only.

The precision/ambiguity audit is strongly corroborated: **12,790 / 13,508 edges (94.6846%)** are independently
supported by both reciprocal official companion metadata and exact canonical substantive text. A further **632**
edges are reciprocal-official-companion-only and **86** are exact-text-only. The artifact keeps **340 unresolved
rows** visible: 315 ambiguous exact-text groups, 19 same-chamber exact-text groups, and 6 weak one-sided companion
pairs. All 32,351 canonicalizable stored official versions used by the matcher retain source lineage. No fuzzy
matching, omnibus containment, title similarity, transitive closure, passage outcome, vote event, or member-vote
label entered the lineage build.

Frozen hashes:
- edge content: `20a196652e89adb6888dcd80a61dc760c965a94391ceff2809036a8939998904`;
- component audit content: `175f4f1efd2d327e1a68a38a95b7a05a744bf0e0d0e5180b299dcd3f4371db73`;
- unresolved content: `38e82f85204c432a939c19279e73bf54c5891ce453d1e23d16270a8346f2be86`;
- frozen lineage content: `f7aa44574c109fc5a26968e0f7e5b6fd66d0ac9aa6705fdd41abb2cd798a4112`;
- complete artifact content: `e529128ed20c7a096f5ef639407924a7526b002e9382121f97a353ec8808fc49`;
- GitHub artifact digest: `sha256:abec75e1923ddd3aa69b244c369295527c4857da3fd92d6169d4c322c0596cb0`.

The first production audit run `35901402339` is superseded by the hardened direct-edge/provenance contract above.
Historical P7 outcome scoring may proceed only if the evaluator reproduces the frozen lineage-content hash exactly.

Frozen P7 outcome result (2026-09-23): production run `35905423205` on code SHA
`093c080a87450211e4d498c117873c38202cd166` reproduced the frozen lineage SHA exactly **before** executing the
first outcome-bearing query, then evaluated `substantive_vehicle_passage_v1` without changing the strict target.
The result contains **654 strict bill-number positives** and **1,305 substantive-vehicle positives** across all
31,010 bills, so **651 bills** are incremental positives because a direct accepted vehicle passed while the original
number did not. Every incremental positive has exactly one successful direct neighbor; graph transitivity contributes
zero labels.

The incremental positives are overwhelmingly supported by the strongest relationship evidence: **597 / 651** use
an edge backed by both exact substantive text and reciprocal official companion metadata, **46** use reciprocal
official companion metadata only, and **8** use exact substantive text only. By biennium, incremental positives are
192 in 2021-22, 206 in 2023-24, and 253 in 2025-26. By originating chamber they are 230 House and 421 Senate. These
counts are descriptive vehicle-lineage outcomes; they do not imply that every provision survived unchanged or that
the companion relationship caused passage.

The accepted introduction-stage v4 probabilities were then **rescored without retraining** on the later-biennium
21,495-bill holdout population. On the original strict target they reproduce the frozen baseline exactly:
Brier **0.02060092**, log loss **0.09802744**, ECE **0.00260184**, AP **0.16436**, and ROC-AUC **0.78224**. On the
separate P7 target the same unchanged probabilities have Brier **0.04094816**, log loss **0.17802795**, ECE
**0.02395564**, AP **0.28022**, and ROC-AUC **0.78341**. The substantive target positive rate is **4.2615%** while
the unchanged v4 mean probability is **1.8659%**. Therefore v4 retains similar ranking information for the broader
vehicle outcome, but it is materially under-calibrated for that different target. The higher AP must be interpreted
against the roughly doubled positive base rate and is not evidence that v4 was trained for the secondary target.

Frozen P7 result hashes:
- label NDJSON / label-content SHA-256:
  `5b18378725c736dd4eceb37992fd4295cbd779e24e3cdd92123f28192ab75eec`;
- unchanged-v4 transfer NDJSON SHA-256:
  `1edb9e1466e5449fec5d382cfac6bcffa01c67be1cc0da52981506cb43fab8a6`;
- report file SHA-256: `aafdfc01fd60454706db399648b2968ce4fa723b356ed3c786eb4a3e5071b9e1`;
- GitHub artifact digest:
  `sha256:df026d3bc0d14c599c6dab4ea953fee2f6e12f7ac0ac700eb3a29f9d454b20b0`.

P7 is therefore **complete and frozen** as a retrospective development/robustness phase. It establishes a useful
separate vehicle-level label and shows that the accepted strict-target v4 ranking signal transfers to it, but it does
not authorize recalibration, retuning, or serving changes. Production action remains **none**. The governing next
phase is P8 prospective 2027-28 validation under separately reported strict and substantive-vehicle outcomes.

The reproducible outcome-blind entry point is `npm run build:lifecycle:p7-lineage` and the manual
`Lifecycle P7 lineage freeze` GitHub Action. It writes `report.json`, `edges.ndjson`, `components.ndjson`, and
`unresolved.ndjson`. The report records separate edge/component/unresolved hashes plus a combined lineage hash,
coverage by evidence class, ambiguities, unmatched bills, and an explicit declaration of prohibited outcome reads.
Only after that production-data artifact is reviewed and its hash is frozen in the repository may a separate P7
evaluator join the pre-existing strict source-chamber passage labels. No P7 result can alter serving behavior or
promote a model automatically.

### P8 — 2027 prospective validation

- [x] Freeze the prospective capture/evaluation contract before 2027-28 outcomes.
- [x] Freeze the exact 2027 prospective model artifact from completed 2021-26 history.
- [ ] Activate immutable daily lifecycle capture before 2027-28 outcomes.
- [ ] Preserve the serving models while observations accrue.
- [ ] Score only after the frozen prospective reveal/coverage gates are met.

The governing P8 protocol is `lifecycle-p8-prospective-plan-v1`. It deliberately separates model freeze from
production capture activation. The model package must be built entirely from the completed 2021-26 corpus and must
reproduce the frozen P3 snapshot hash plus the accepted P4 and retained-P5 historical prediction vectors before it
can be accepted for 2027. The accepted introduction architecture is fit once on all completed 2021-26
introduction-safe observations; its training-corpus and model-content hashes are part of the P8 gate. The conditional
component remains `member-eb-v1.2-decay180` with only strictly pre-cutoff member/vote/analogue history. No 2027
outcome or 2027 production forecast may enter model fitting.

Frozen P8 model result (2026-09-23): production run `35910925882` on code SHA
`2733a6c8f96e88e1028dbcea7c5d9caac212ab08` passed with **0** 2027-28 bills, strict outcomes,
forecast revisions, vote events, and stage events. It reproduced the frozen P3/P4/P5 historical hashes and the
pinned 2027 introduction corpus/model hashes before emitting `lifecycle-p8-prospective-model-v1`. The frozen
prospective-plan SHA-256 is `2f4e936fe0977049a8f4212c48ee93405dd7b6dff59ee4f801f402a05f3dfd6d`; the
frozen model-content SHA-256 is `abcf583153939d46aa021dccf2afe61d698ad4538a981059cdee265c03166a65`; and
the GitHub artifact digest is
`sha256:72a42063a028114b4f6cbd8a356e74940eb00bdcda28a83cadf884aaa346061e`. The model package contains the
2027 v4 introduction model, the final P4 stage fit over 63,974 frozen P3 snapshots, the retained P5 fits, and the
unchanged `member-eb-v1.2-decay180` P6 conditional contract. These hashes are now fail-closed gates for every
future P8 capture/reproduction run.

Prospective lifecycle capture is **daily and immutable**, using the Minnesota calendar date as a date-exclusive
cutoff. Official process events, bill versions, and member/vote history dated on the cutoff date are excluded because
intraday ordering is not assumed. An existing capture is never rewritten after later source discovery; missingness
at the original capture remains observable. This is intentional: P8 measures what the system actually had available,
not what can be reconstructed later with hindsight.

Daily rows are the source record, not the evaluation unit. After the sealed reveal gate opens, evaluation collapses
them to event-time observations by taking the latest captured row whose cutoff date is **strictly before** each
observed transition or terminal date. A capture from the same calendar date as a transition is ineligible. The
frozen introduction v4 prediction is scored separately at the bill level because a bill first discovered after its
introduction date must not be relabeled as an introduction-time lifecycle snapshot.

The primary target remains strict bill-number source-chamber passage. P7
`substantive_vehicle_passage_v1` is reported separately and requires the same outcome-blind direct-edge lineage
contract to be frozen for 2027-28 before outcome labels are joined. Connected-component transitivity remains
forbidden. Bills without member passage votes remain lifecycle observations only; P8 never manufactures member NAY
labels.

The reveal gate is sealed until **2028-07-01T00:00:00Z** and also requires complete strict outcome labels plus
minimum prospective coverage (95% introduction prediction coverage, 90% lifecycle capture coverage, and 95%
process-source coverage on scored lifecycle rows). Before that gate, operations may report capture/source coverage
and failures but not prospective performance metrics. The governing comparison is frozen 2027 introduction v4 vs
P4 stage-only vs P5 retained direct passage vs P6 decomposed end-to-end, with component and chamber/state slices.
No result can automatically promote a model or alter serving behavior; any serving change still requires separate
human review and integration.
