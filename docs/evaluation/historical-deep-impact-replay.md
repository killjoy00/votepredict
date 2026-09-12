# Historical Deep impact replay

## Purpose

The frozen discovery score established that the pilot's official pre-vote committee procedural signals are associated with later floor behavior, but that result alone does not show whether the existing Deep probability-impact machinery improves Quick forecasts.

This replay asks two narrower questions without tuning anything:

1. If the current production-parity 12-person Deep target set had access to the already-frozen official signals, would the existing evidence policy and `logit-evidence-v1` impact improve the frozen Quick probabilities?
2. If every chamber member were eligible to receive those same already-frozen signals, what is the research-availability ceiling for the unchanged impact rule?

The second scenario is an evaluation ceiling, not a proposed live targeting policy.

## Frozen inputs

`data/evaluation/historical-deep-impact-replay-lineage-v1.json` pins four GitHub Actions artifacts by run ID, artifact ID, name, head SHA, and SHA-256 digest:

- the chamber-wide historical Deep discovery manifest, which contains the frozen Quick probabilities and the outcome-blind current Deep target IDs;
- the official pre-vote source bundle;
- the deterministic discovery candidate artifact;
- the official outcome snapshot created only after candidate extraction was frozen.

The workflow verifies every artifact digest before download. No database query, current web request, Vercel runtime request, or AI research call is made during replay.

## Candidate-to-evidence conversion

The conversion is fixed before replay scoring:

- evidence kind: `fact`;
- source quality: `official`;
- relevance: `high`;
- extraction confidence: `1`;
- mechanically actionable: `true` only for an unambiguous procedural direction;
- stance: support/opposition derived deterministically from the motion direction and the member's AYE/NAY side;
- freshness: measured from the source publication timestamp to the historical `asOf` cutoff using the production thresholds (`<=365` days current, `<=1095` days recent, otherwise stale).

A committee procedural vote is deliberately **not** labeled a direct statement. It is a verified member action on the bill and is therefore represented as a fact with high, rather than direct, relevance.

Each candidate is revalidated against the frozen source bundle by case, source ID, source class, canonical URL, publication timestamp, and content SHA-256 before conversion.

## Existing production impact only

Converted evidence is passed through:

1. `HistoricalArchiveDeepResearchProvider` for historical cutoff/provenance validation;
2. `evidenceImpactPolicy` for mechanical-actionability checks;
3. `applyEvidenceSignals` using the existing `logit-evidence-v1` weights.

No impact coefficient, target score, probability threshold, evidence class, or confidence value is selected by looking at the floor outcome.

## Scenarios

### `current-targets`

Only members contained in the frozen production-parity `currentDeepTargetIds` for each vote may receive evidence. This isolates the targeting bottleneck while leaving the impact rule unchanged.

### `discovery-all`

All chamber members are eligible to receive the already-frozen official procedural evidence. This measures an upper-bound discovery scenario for the existing impact rule. It is not a recommendation to research every member in production.

## Scoring

For each scenario the replay reports:

- number of requested targets and frozen candidate observations;
- returned, applied, and excluded evidence items;
- affected and probability-changed members;
- all decisive member-level Quick-vs-Deep accuracy, Brier score, log loss, and ECE;
- the same metrics on evidence-affected decisive members only;
- classification flips, Quick errors corrected, and previously-correct classifications harmed;
- per-case diagnostics.

Members without a decisive floor YEA/NAY remain outside the scoring denominator.

## Guardrails

This workstream is evaluation-only. It performs no forecast writes, database writes, production targeting changes, evidence-weight changes, or serving probability changes. A favorable replay is evidence for a larger archive-safe evaluation, not permission to tune or deploy the pilot result directly.
