# VotePredict V2 Rebuild Plan

## Decision

VotePredict V2 is a clean-slate rebuild.

The current application is not a compatibility target and should not constrain product, data, API, model, or UI decisions. The next implementation phase may delete the existing frontend, server routes, prediction code, types, tests, and configuration where they do not fit the V2 design.

Useful legacy ideas can be reimplemented deliberately, but V1 code does not receive preservation priority merely because it already exists.

## Foundation PR

This planning/foundation PR establishes:

- `CHARTER.md` — product mission, scope, principles, modes, outputs, and non-goals;
- `docs/ARCHITECTURE_V2.md` — durable concepts, persistence model, forecast lifecycle, and system boundaries;
- `docs/DATA_AND_EVIDENCE.md` — historical data, source hierarchy, evidence provenance, and research behavior;
- `docs/EVALUATION_STANDARD.md` — backtesting, calibration, baselines, and model-promotion gates;
- this rebuild sequence and backlog.

No forecast implementation should be treated as production V2 until it satisfies the evaluation discipline in these documents.

## Recommended PR sequence

The sequence is intentionally structured so the forecasting model is measured before a polished UI makes weak outputs feel finished.

### PR 2 — Clean-slate application and persistence foundation

**Goal:** remove the legacy product architecture and establish the V2 skeleton.

Work:

- replace/delete V1 application code that does not belong in V2;
- introduce a clean application structure;
- add PostgreSQL persistence and migrations;
- add private authentication;
- create the core session/chamber/legislator/membership/bill/forecast schemas;
- establish environment/config conventions;
- preserve or recreate CI with typecheck/test/build/database checks;
- deploy a minimal authenticated V2 shell rather than preserving the old predictor.

Acceptance:

- legacy prediction UI/engine is no longer presented as the product;
- database can be created from migrations;
- private user can authenticate;
- core entities can be created/read in tests;
- CI and deployment are green.

### PR 3 — Minnesota official-data adapters and historical vote store

**Goal:** build the trustworthy historical substrate.

Work:

- Minnesota jurisdiction/session configuration;
- official House/Senate/Revisor adapters;
- legislators + membership periods;
- bills and versions;
- sponsorship/committee data where reliable;
- vote events and member votes;
- source provenance and raw/normalized semantics;
- initial ingestion for approximately the last 2–3 legislatures;
- data-quality checks and repeatable import commands.

Acceptance:

- representative official votes can be reproduced from source to database;
- member vote totals reconcile with official results where comparable;
- session/roster changes are represented historically;
- ingestion is idempotent/repeatable;
- source conflicts are observable and official records win.

### PR 4 — Evaluation harness and simple baselines

**Goal:** create the scoreboard before building the sophisticated model.

Work:

- time-aware train/validation/test splits;
- leakage controls;
- party-line baseline;
- member-history baseline;
- initial bill/caucus baseline;
- passage/member accuracy;
- Brier score/log loss;
- calibration reporting;
- chamber vote-margin error;
- slice reports.

Acceptance:

- one command/workflow produces reproducible baseline results;
- held-out votes are not used in feature generation;
- results are stored/versioned enough to compare future models;
- evaluation limitations are documented.

### PR 5 — Bill understanding and historical analogue engine

**Goal:** produce structured, inspectable bill features and useful similar-vote retrieval.

Work:

- versioned bill feature schema;
- AI-assisted feature extraction;
- historical analogue retrieval;
- same/reintroduced/companion-bill recognition where possible;
- substantive comparison explaining similarities and differences;
- historical relevance/decay as tunable configuration;
- analogue quality tests/diagnostics.

Acceptance:

- a target bill yields inspectable structured features;
- historical analogues can be shown with reasons/differences;
- feature/analogue inputs can be generated as-of a historical cutoff;
- adding these features is evaluated against simpler baselines.

### PR 6 — Member forecast engine, calibration, and chamber simulation

**Goal:** turn historical/member/bill features into empirically defensible probabilities.

Work:

- common member-level forecasting model;
- individualized member features;
- probability calibration;
- cannot-predict logic;
- uncertainty interval candidate(s);
- evidence-quality candidate(s) for stored historical data;
- chamber simulation from member probabilities;
- correlation/dispersion diagnostics;
- passage probability and vote-range output.

Acceptance:

- member probabilities beat or justify themselves against required baselines;
- calibration is measured;
- passage probability is derived from member forecasts;
- reported vote ranges have measured coverage;
- model/config is versioned and reproducible.

### PR 7 — Evidence store and Deep research mode

**Goal:** add current sourced evidence without turning web research into an opaque oracle.

Work:

- evidence source/item schema;
- targeted consequential-member selection;
- current public-source research workflow;
- direct/related statement extraction;
- source-quality/relevance/freshness classification;
- contradiction/supersession handling;
- forecast recomputation after evidence;
- Quick vs. Deep comparison in evaluation where historically possible.

Acceptance:

- Deep forecast shows exactly what fresh evidence changed;
- every material claim has source provenance;
- facts, inference, and context remain distinguishable;
- direct statements can strongly affect the forecast without hardcoded literal certainty;
- noisy research can be diagnosed/removed.

### PR 8 — Private consumer forecasting UI

**Goal:** make the validated engine pleasant to use for the primary user.

Primary flow:

1. identify actual bill or enter/upload proposal;
2. select chamber;
3. choose Quick or Deep;
4. generate forecast;
5. inspect passage result;
6. inspect member table and consequential members;
7. drill into facts/evidence, model inference, context, and sources.

Core displays:

- passage probability;
- expected vote + likely range;
- member Yes/No probability;
- member plausible probability interval;
- evidence quality;
- cannot-predict state;
- consequential/uncertain member flags;
- evidence/source drawer;
- forecast revision history.

Acceptance:

- primary workflow is simple and consumer-oriented;
- analytical detail is available on demand;
- UI does not imply false deterministic certainty;
- Quick/Deep distinction is understandable;
- actual and proposed bills are clearly differentiated.

### PR 9 — Forecast updates, scenarios, subsets, and sharing

**Goal:** add the work-oriented power features.

Work:

- Update Forecast -> immutable new revision;
- Generate New Forecast -> new forecast identity;
- revision diffing;
- scenario mode and overrides;
- custom member subset/committee analysis;
- selected read-only share links;
- share revocation.

Acceptance:

- scenarios cannot mutate official forecasts or training truth;
- subset analysis returns a member table without inventing procedural thresholds;
- revisions are historically inspectable;
- read-only links expose only explicitly shared material.

### PR 10 — Production hardening and ongoing scorecard

**Goal:** make the private tool reliable enough for routine professional use.

Work:

- durable rate/cost limits where needed;
- ingestion monitoring;
- research/provider failure handling;
- data freshness indicators;
- scheduled/triggered data refresh strategy;
- security review;
- backup/restore expectations;
- production forecast vs. actual-outcome scorecard;
- model promotion workflow;
- parser/source change alerts.

Acceptance:

- failures degrade transparently;
- forecast lineage remains intact;
- production results can later be scored against actual votes;
- operational costs and external API usage are bounded/observable.

## Initial backlog

### P0 — required for trustworthy V2

- [ ] Select V2 application/server framework and repository structure.
- [ ] Select PostgreSQL provider and migration/ORM strategy.
- [ ] Implement private authentication.
- [ ] Define jurisdiction/session/chamber schema.
- [ ] Define legislator identity + time-bounded membership schema.
- [ ] Define bill/version/proposal schema.
- [ ] Define vote-event/member-vote schema preserving raw official semantics.
- [ ] Build Minnesota official source adapters.
- [ ] Import roughly 2–3 legislatures of Minnesota roll calls.
- [ ] Build data-quality/reconciliation reports.
- [ ] Build leakage-safe evaluation dataset generation.
- [ ] Implement party-line and member-history baselines.
- [ ] Implement evaluation metrics/calibration reports.
- [ ] Define versioned bill feature schema.
- [ ] Build historical analogue retrieval.
- [ ] Implement first member probability model.
- [ ] Implement probability calibration.
- [ ] Implement chamber simulation and vote ranges.
- [ ] Test member-error correlation and interval coverage.
- [ ] Implement evidence source/item storage.
- [ ] Implement targeted Deep research orchestration.
- [ ] Implement direct/related statement handling.
- [ ] Persist forecast/revision/model/data provenance.
- [ ] Build private forecast UI.

### P1 — important professional workflow

- [ ] Forecast revision diffing.
- [ ] Quick vs. Deep update flows.
- [ ] Scenario mode.
- [ ] Custom member subsets/committee selection.
- [ ] Proposed-bill file upload and extraction.
- [ ] Read-only share links.
- [ ] Forecast-vs-actual production scorecard.
- [ ] Evidence contradiction/supersession UI.
- [ ] Model/evaluation comparison dashboard or report.

### P2 — after the core is reliable

- [ ] Additional state adapter proof-of-concept.
- [ ] Broader source integrations where they demonstrably improve forecasts.
- [ ] Collaborative/multi-user features if actual use requires them.
- [ ] Public-facing product/SEO only if the private tool becomes worth publishing.

## Deliberately deferred implementation choices

These decisions should be made through experiments rather than charter debate:

- exact historical decay curve;
- exact bill-similarity formula;
- statistical/ML model family;
- LLM/provider/model used for bill/evidence extraction;
- probability calibration technique;
- uncertainty interval method;
- evidence-quality scoring thresholds;
- chamber simulation correlation model;
- exact threshold for "cannot predict";
- number of legislators researched in Deep mode;
- database/hosting vendor details;
- precise UI visual design.

The project should retain the ability to change these without changing its mission.

## Risks to keep visible

### Data leakage

The easiest way to build an impressive but fake historical model is to let future information leak into the past. Time-aware data construction is a permanent concern.

### Misleading precision

A percentage can look scientific before it is calibrated. UI work must not outrun evaluation.

### Correlated member errors

If every member forecast shares the same misunderstanding of a bill, independent simulation can drastically overstate chamber certainty.

### Noisy current research

Deep mode can become worse than Quick mode if indirect speculation is treated as fact. Source provenance and empirical comparison are mandatory.

### Identity/history problems

Legislator identity, party changes, district changes, appointments, vacancies, and turnover need temporal modeling rather than a single current-roster table.

### Upstream source changes

Official pages/APIs can change structure. Adapters require validation and monitoring.

### Model complexity creep

Every extra signal should justify itself through evaluation. VotePredict should not become a collection of clever features that cannot beat a simple baseline.

## Definition of a credible V2 beta

VotePredict V2 is ready for routine private beta use when:

- Minnesota historical data is reproducibly ingested and reconciled;
- member and passage forecasts are evaluated on held-out votes;
- the default model is benchmarked against simple baselines;
- displayed probabilities are calibrated enough to have empirical meaning;
- vote ranges have measured coverage;
- a forecast can show the actual evidence behind consequential member estimates;
- Deep mode clearly identifies fresh evidence and resulting changes;
- forecasts and revisions are persistently reproducible;
- the private UI supports actual and proposed bills;
- failures and cannot-predict states are transparent;
- the owner can use a forecast in professional work without needing to reverse-engineer how the number was produced.
