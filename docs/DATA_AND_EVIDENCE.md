# VotePredict V2 Data and Evidence Strategy

## Purpose

VotePredict's credibility depends on the evidence behind its forecasts. This document defines the initial strategy for historical legislative data, current public evidence, source provenance, bill similarity, and data quality.

The system should store facts in a form that can survive changes to models and user interfaces.

## Source-of-truth policy

### Official legislative sources

Official jurisdiction sources are authoritative for facts such as:

- recorded votes;
- bill text and versions;
- sponsors/co-sponsors;
- chamber/session identity;
- membership and official roles;
- committee assignments and actions when published;
- vote result and date.

For Minnesota, V2 should build dedicated adapters for the official House, Senate, Revisor, and any other required official endpoints/pages.

### Normalized third-party sources

Sources such as OpenStates may be used for:

- normalized identifiers;
- convenient discovery;
- enrichment;
- cross-checking;
- fallback when an official endpoint is temporarily difficult to consume.

When a third-party record conflicts with a verified official record, the official record wins and the discrepancy should be observable in ingestion logs or data-quality tooling.

## Initial historical horizon

The initial Minnesota dataset should cover roughly the last **two to three legislatures**, not the longest possible historical record.

The intent is to capture enough votes for meaningful backtesting while reflecting a legislature with substantial turnover and changing political conditions.

Older data can be added later if evaluation shows meaningful value.

## Historical vote ingestion

For each recorded vote, retain as much of the following as official sources make available:

- jurisdiction;
- legislative session;
- chamber;
- date/time;
- bill and bill version if applicable;
- vote identifier;
- motion/question text;
- vote type/category;
- required threshold if known;
- actual result;
- official source reference/URL;
- each member's recorded vote;
- roster/membership context at the time.

Do not prematurely normalize away chamber-specific vote categories. Preserve raw official semantics and derive modeling categories separately.

## Historical relevance and decay

An old recorded vote on the same issue remains evidence; it should not disappear because it crossed an arbitrary cutoff.

Starting product intuition:

- same-session vote on the same/substantially identical issue: extremely strong evidence;
- immediately prior legislature: still strongly persuasive;
- legislature before that: meaningful but materially weaker;
- earlier: progressively weaker.

The owner's initial intuition can be represented roughly as weights that might feel like `98 / 90 / 60 / 40 / ...` across recency tiers for a genuinely same-issue vote. These numbers are **not business rules**. They document the desired shape of the prior and must become tunable parameters evaluated through backtesting.

Bill similarity and substantive changes can reduce relevance even when the political topic appears identical.

## Bill versions and stage

Evidence and forecasts must point to the bill version/stage they concern whenever possible.

A prior public statement about an introduced bill may become less relevant if a later amendment materially changes the provision that motivated the statement.

Likewise, a historical analogue should not be treated as identical solely because it has the same title or issue category.

## Bill feature extraction

Candidate structured features include:

- subject/policy families;
- major substantive provisions;
- taxes/revenues/appropriations;
- fiscal magnitude/direction when available;
- affected constituencies/industries/groups;
- regulatory expansion/reduction;
- ideological/political direction;
- mandate/prohibition/incentive structure;
- sponsors and sponsor party/chamber;
- committees;
- stage/status;
- companion/reintroduced measure relationships;
- text representation for semantic similarity.

AI may extract these features, but the extraction process must be versioned and the features stored.

## Historical analogue retrieval

Similarity should use multiple signals rather than a single text score.

A candidate analogue may be strong because it is:

- a prior version or reintroduction of the same proposal;
- a companion measure;
- substantively similar in provisions;
- in the same policy family with similar political implications;
- directed at the same constituencies;
- fiscally/politically comparable.

For every analogue materially used in a forecast, the system should be able to show:

- which prior bill/vote was selected;
- similarity score or category;
- important common features;
- important differences;
- why the analogue was considered relevant.

## Current public evidence

Deep forecasts should research current public information only after an initial quantitative forecast identifies the legislators where additional information is likely to matter.

Likely research targets include:

- members near 50/50;
- members whose vote has high leverage on passage probability;
- members with contradictory historical signals;
- members where a direct statement may exist;
- leadership or sponsors when their position is consequential.

The research system should be able to expand beyond that set when evidence discovered during research indicates additional relevant members.

## Evidence record design

A stored evidence item should contain enough information to understand the claim without re-running the research process.

Recommended fields include:

- source identifier;
- source URL/reference;
- source owner/publisher;
- publication/statement date;
- retrieval timestamp;
- subject legislator;
- target bill/provision/policy family;
- extracted factual claim;
- stance/direction if applicable;
- evidence type;
- source-quality class;
- directness;
- specificity;
- relevance;
- freshness;
- contradiction state;
- supporting excerpt or structured source location where appropriate;
- extraction model/version;
- verification state;
- superseded-by link when a later statement clearly replaces an earlier one.

## Facts, inference, and context

The product must distinguish:

### Facts / evidence

Claims grounded in identifiable sources, such as:

- member voted Yes on a recorded vote;
- member co-sponsored a bill;
- member stated support/opposition publicly;
- member serves on a committee.

### Model inference

Conclusions derived from facts, such as:

- member historically crosses party lines on this policy family;
- three of four highly similar votes point toward Yes;
- this member is more supportive than the caucus baseline on the issue.

### Context

Broader explanatory features such as district characteristics, affected constituencies, political geography, or caucus environment.

Generated explanations should cite back to these stored categories rather than blur them together.

## Direct statements

An unambiguous current statement about the exact target vote is among the strongest possible evidence.

Example:

> "I will vote yes on HF 123."

Initial product behavior may move the member forecast toward approximately **98% Yes**, but never 100%. The exact effect remains tunable.

Rules:

- verify the identity and source;
- retain statement date and exact target when possible;
- prefer the newest unambiguous statement when positions conflict over time;
- do not treat third-party speculation as equivalent to a direct commitment;
- reduce relevance if the bill materially changes after the statement;
- show the statement as a primary reason for the forecast.

## Related statements

A member's public opposition/support for the substantive policy in a bill is strong evidence even without a bill-specific commitment, but it remains part of the probabilistic evidence mix.

The model should assess:

- how closely the statement maps to the actual provision;
- whether the bill includes exceptions/changes relevant to the position;
- recency;
- whether subsequent statements contradict it.

## Source-quality hierarchy

Initial hierarchy, subject to refinement:

### Tier A — strongest provenance

- official recorded legislative action;
- legislator's own official statement/communication;
- direct interview/source transcript with clear attribution.

### Tier B — strong reporting

- reputable reporting that directly quotes or reports the member's position;
- high-quality primary reporting on negotiations or stated commitments.

### Tier C — useful first-party/organizational material

- campaign material;
- endorsements/questionnaires;
- interest-group scorecards or statements with clear sourcing;
- organizational publications.

### Tier D — secondary/contextual

- reputable analysis;
- indirect reporting;
- district/political context;
- derived ideological/comparable-member signals.

Source tier does not determine weight by itself. A Tier A statement about a vaguely related issue may be less relevant than a highly specific Tier B report about the target bill. Quality, directness, specificity, recency, and contradiction all matter.

## Conflicting evidence

Conflicts should remain visible and probabilistic.

Example:

- similar-vote history favors Yes;
- district context favors Yes;
- one credible report expects No;
- member has not commented directly.

The correct response may be a point estimate near the middle, a wider uncertainty interval, and an explicit `conflicting evidence` label—not silent selection of whichever evidence fits the initial model.

## Evidence reuse and freshness

Evidence can be reused across forecast revisions when it remains relevant, but every revision should know which evidence set it used.

Update logic should consider whether evidence has become:

- stale;
- superseded;
- contradicted;
- irrelevant after a bill amendment;
- newly reinforced by additional sources.

A Quick update may reuse stored evidence. A Deep update should actively check for consequential changes.

## Proposed legislation

V2 should accept proposed legislation through:

1. pasted legislative/draft text;
2. a plain-language policy description;
3. an uploaded draft document.

The user selects the chamber to forecast.

Proposed bills have no official bill history, so the system should:

- store the supplied proposal as a versioned artifact;
- extract the same structured bill features used for actual bills;
- retrieve historical analogues;
- research relevant member evidence in Deep mode;
- make the absence of official bill/sponsorship/stage information part of the uncertainty/evidence-quality calculation.

## Data-quality checks

Automated ingestion should validate at least:

- source response shape;
- duplicate vote/member identities;
- expected chamber/session relationships;
- impossible member votes outside membership periods;
- vote totals vs. reported totals when available;
- bill/version linkage;
- missing or conflicting official identifiers;
- source freshness;
- changes in upstream parsing behavior.

Data-quality failures should be observable and should fail closed when they would materially corrupt forecasting/evaluation.

## Data lineage

Forecast revisions must be able to identify the data/evidence state used to produce them. Exact storage mechanics are deferred, but the end state must support reproducible lineage from:

`forecast revision -> model/config -> feature set -> evidence set -> historical/official source records`

## Data retention

Forecast/evaluation integrity requires retaining historical facts, derived features, and evidence metadata long enough to reproduce prior revisions and score them later.

When retaining excerpts from public web sources, store only what is appropriate for provenance/explanation and avoid unnecessary copying of source content. Prefer structured claims and source references over mirroring full articles.
