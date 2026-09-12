# VotePredict V2 Architecture

## Status

This document defines durable V2 boundaries. Implementation details may change when evaluation or operational evidence shows a better approach, but forecast-target semantics, leakage controls, lineage, and auditability are architectural requirements.

## Architectural goals

VotePredict V2 should:

- support a general legislative forecasting engine with Minnesota as the first jurisdiction;
- support distinct forecast stages without conflating their probabilities;
- persist historical legislative data, evidence, forecasts, revisions, scenarios, and model metadata;
- make every important forecast auditable and reproducible;
- separate source facts from model inference and generated explanation;
- derive **current/floor** chamber passage probability from member-level probabilities;
- support a separately evaluated **introduction-stage** source-chamber passage model over the complete introduced-bill universe;
- support Quick and Deep research modes for current/floor forecasting;
- support full chambers and arbitrary member subsets;
- keep private-user workflows simple;
- make models, feature sets, weighting schemes, and data adapters replaceable;
- fail closed when an information cutoff cannot be reconstructed safely.

## Forecast-stage architecture

VotePredict has two numeric chamber-passage paths with different conditioning information.

```text
                    Official legislature sources
                              |
                              v
                    PostgreSQL source/data store
                              |
              +---------------+----------------+
              |                                |
              v                                v
   Introduction-time snapshot          Current/as-of snapshot
              |                                |
   frozen intro feature logic             bill/member/evidence
              |                                |
   session-pinned intro model          member probability model
              |                                |
              v                                v
 unconditional source-chamber            member probabilities
 passage prior at introduction                  |
              |                         chamber aggregation
              |                                |
              +---------------+----------------+
                              |
                              v
                     Private web application
```

The two outputs are never interchangeable:

- **Introduction forecast:** probability, assessed at introduction, that the bill eventually passes its originating chamber during the biennium. It includes bills that never receive a floor vote.
- **Current/floor forecast:** probability that the selected chamber vote passes given the information available at the forecast timestamp. Its chamber probability is derived from member forecasts.

## Persistence

PostgreSQL is the system of record for:

- jurisdictions and legislative sessions;
- chambers and committees;
- legislators and time-bounded memberships;
- actual bills and bill versions;
- introduction timestamps and authoritative initial-version provenance;
- proposed/hypothetical bills;
- recorded vote events and member votes;
- normalized bill features;
- evidence sources and extracted evidence claims;
- model/configuration versions and frozen introduction artifacts;
- forecasts and immutable forecast revisions;
- member-level forecasts;
- evidence linked to forecasts;
- scenarios and user overrides;
- eventual observed outcomes for evaluation.

Durable forecasting behavior must not depend on mutable in-memory state or request-time retraining from production labels.

## Core data entities

### Jurisdiction/session/chamber

`jurisdiction`, `legislative_session`, and `chamber` define the legislative context. Jurisdiction-specific source identifiers remain behind adapter boundaries.

### Legislator and membership

`legislator` represents stable person identity where possible. `membership` represents service in a chamber, district, party/caucus, and time period so current attributes are never treated as timeless.

### Bill and bill version

`bill` represents a logical measure. `bill_version` represents a specific official text/version/stage. Introduction-stage modeling must retain the exact zero-engrossment document provenance and whether that document was actually available on or before introduction.

### Proposal

A `proposal` is user-supplied hypothetical or draft legislation. It is used by the current/floor forecasting workflow and is not automatically eligible for the official introduced-bill introduction model.

### Vote event and member vote

`vote_event` stores chamber/date/question/threshold/result/source metadata. `member_vote` preserves official member-vote semantics before any modeling normalization.

### Evidence

`evidence_source` identifies the underlying source. `evidence_item` stores a specific extracted claim/fact with date, subject, relevance, directness, quality, freshness, contradiction state, and provenance.

### Feature/model/data versions

`bill_feature_set`, model/configuration identifiers, and data-snapshot manifests make derived information reproducible.

For introduction models, a serving artifact must additionally identify:

- supported session;
- training sessions and cutoff;
- frozen numeric settings;
- feature/token statistics;
- serialized artifact identity/integrity metadata;
- fallback policy for missing-at-introduction inputs.

### Forecast, revision, and member forecast

A `forecast` is the durable identity for the current/floor workflow. `forecast_revision` is immutable and records the model/data/evidence state used at that moment. `member_forecast` stores per-member probability, interval/evidence-quality metadata, and structured reasons.

Introduction forecasts may be computed from a frozen session artifact without creating the same revision/member graph; their runtime must still expose model and source-provenance identity so the result is auditable.

### Scenarios and subsets

Scenarios are explicit counterfactual overlays. Scenario assumptions never become historical truth, evidence, training data, or default model inputs. Custom subsets primarily expose member distributions unless a valid procedural threshold is explicitly defined.

## Source adapter boundary

Minnesota-specific logic belongs behind adapters so the forecasting core does not directly depend on Revisor URLs, Minnesota session identifiers, House/Senate page formats, or roster peculiarities.

Official Minnesota records are authoritative when they conflict with normalized third-party data.

Adapters should support, as available:

- session/chamber discovery;
- legislators and memberships;
- bills and official versions;
- exact introduction actions/dates;
- vote events and member votes;
- sponsorship and committee actions;
- authoritative source links/provenance.

## Introduction forecast pipeline

### 1. Resolve the complete source-chamber universe

Evaluation is based on every introduced bill in the supported regular-session universe, not only bills that later receive floor votes.

### 2. Freeze the introduction-time information set

Eligible inputs must be knowable at introduction. Current Minnesota v4 uses official Revisor title/description plus the opening purpose statement of the zero-engrossment document only when that document was posted on or before introduction.

Later actions, later versions, current sponsor/companion state without historical provenance, committee movement, scheduling, and outcomes are forbidden.

### 3. Apply the session-pinned serving artifact

Production uses a frozen artifact trained only on completed earlier sessions. Runtime must not retrain against mutable same-session outcomes.

### 4. Apply explicit fallback/fail-closed behavior

When introduction-time text is unavailable but an evaluated title fallback exists, use that fallback. Unsupported future sessions fail closed until a new artifact earns promotion.

### 5. Return the introduction prior with lineage

The UI/API must identify the target as unconditional source-chamber passage at introduction and retain model/version/provenance sufficient to audit the result.

## Current/floor forecast pipeline

### 1. Resolve target

Identify jurisdiction/session, target bill/proposal version, selected chamber, active roster, and forecast-time cutoff.

### 2. Construct bill features

Create a versioned structured bill representation. AI may assist, but material features must be stored and reproducible.

### 3. Build historical/member features

Candidate inputs include same/substantially similar votes, policy-family behavior, sponsorship, committee behavior, caucus patterns, district context, tenure, and comparable-member signals.

### 4. Produce member probabilities

A common replaceable model produces individualized member probabilities. Numeric prediction must be benchmarked against simple baselines.

### 5. Research consequential evidence for Deep mode

Identify members where fresh evidence could materially affect the chamber forecast or where uncertainty is high. Research only sourced current information and persist evidence provenance.

### 6. Recompute member probabilities

Combine stored quantitative/history features with sourced current evidence. Conflicts remain explicit and probabilistic.

### 7. Aggregate the chamber

Use exact aggregation or simulation under the applicable threshold to derive passage probability, expected vote, likely range, and consequential members. Correlation/dispersion assumptions must be evaluated rather than cosmetically widened.

### 8. Persist an immutable revision

Store enough lineage to reconstruct bill version, chamber, roster, feature version, evidence set, model/configuration, research mode, timestamp, member outputs, and chamber outputs.

## Forecast lifecycle

- **Generate new forecast:** creates a new current/floor forecast identity and first revision.
- **Update forecast:** creates another immutable revision under the same identity.
- **Quick vs. Deep:** research depth is recorded on the revision; it is not a separate forecast identity.
- **Introduction forecast:** separate pre-floor product surface using the frozen introduction-stage artifact for the supported session.

## Evidence hierarchy

Initial ordering, subject to evaluation:

1. official recorded legislative action;
2. direct legislator statement or first-party official communication;
3. high-quality primary reporting/interview;
4. campaign or organization material with clear provenance;
5. reputable secondary reporting/analysis;
6. weaker contextual or derived signals.

Quality is only one dimension. Relevance, recency, specificity, directness, and contradiction also matter.

## Uncertainty semantics

Current/floor forecasts distinguish:

1. point probability;
2. plausible probability interval;
3. evidence quality.

Introduction forecasts currently expose a calibrated point probability from the accepted model and should not manufacture member-level intervals/evidence labels that the model does not produce.

## Authentication and sharing

V2 is private by default. Owner authentication is required for private forecasting/research/scenario/history workflows. Explicit revocable read-only links may expose a selected frozen current/floor forecast revision.

## AI responsibilities

Good AI uses include structured bill extraction, substantive comparison, analogue discovery, sourced evidence extraction/classification, contradiction recognition, and explanation generation.

AI is not an uncalibrated oracle for numeric member, current/floor passage, or introduction-stage passage probability.

## Replaceability

The architecture must allow independent replacement of:

- jurisdiction adapters;
- source/research providers;
- introduction-stage feature logic/model artifact;
- bill-feature extraction;
- similarity model;
- member forecasting model;
- historical decay logic;
- evidence weighting;
- calibration method;
- uncertainty method;
- chamber aggregation/simulation;
- explanatory model/UI.

Backtesting must be able to disprove today's preferred implementation without forcing another product rewrite.