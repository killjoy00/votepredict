# Historical Deep targeted impact replay

## Decision being tested

The frozen target-strategy bakeoff shows that the production-parity `live-current` selector is not using the 12-person Deep research budget efficiently. This evaluation asks whether an already-defined, outcome-blind selector can route the same frozen official evidence to more useful members without increasing research spend or tuning evidence weights.

The candidate is `need-only`.

This is intentionally the smallest structural change from `live-current`: it preserves the existing 70% uncertainty + 30% evidence-gap need score and removes only the chamber pivotality multiplier. It is not chosen by looking at the six-vote Deep pilot outcomes.

## Frozen bakeoff gate

The workflow pins the original target-strategy artifact by run ID, artifact ID, head SHA, and SHA-256 digest. Before any Deep replay is allowed, `need-only` must beat both `live-current` and `deterministic-uniform` by at least 0.02 absolute on **both** classification-error recall and Brier-error-mass recall on **both** the development split and the untouched 2025–26 holdout.

The pinned bakeoff clears that gate:

| Split | Selector | Error recall | Brier-mass recall | High-confidence-error recall |
| --- | --- | ---: | ---: | ---: |
| Development | `live-current` | 0.062328 | 0.064348 | 0.095238 |
| Development | `deterministic-uniform` | 0.114872 | 0.118260 | 0.153439 |
| Development | `need-only` | **0.238791** | **0.222220** | 0 |
| 2025–26 holdout | `live-current` | 0.199841 | 0.179046 | 0.031761 |
| 2025–26 holdout | `deterministic-uniform` | 0.125119 | 0.116601 | 0.096246 |
| 2025–26 holdout | `need-only` | **0.336566** | **0.246120** | 0 |

The zero high-confidence-error recall is a real limitation and remains visible in the artifact. This candidate is being tested because the active question prioritizes member classification-error and Brier-mass capture, not because it dominates every targeting metric.

## Immutable replay inputs

`data/evaluation/historical-deep-targeted-impact-replay-lineage-v1.json` pins five artifacts:

1. the frozen target-strategy bakeoff;
2. the frozen chamber-wide Quick/discovery manifest;
3. the frozen official historical source bundle;
4. the frozen deterministic discovery candidates;
5. the frozen post-discovery official outcome snapshot.

Every artifact digest is verified before download. The replay makes no database query, current web request, Vercel runtime request, or AI research call.

## Candidate target construction

For each frozen pilot vote, the evaluator adapts the already-frozen Quick member rows into the existing `selectHistoricalDeepTargetsByStrategy(..., 'need-only', 12)` implementation. The selector can see only the pre-vote Quick probability/support fields and stable member IDs already present in the frozen discovery manifest.

The later floor outcome is not present in the selector input. The original production-parity target IDs remain untouched in the source artifact; an in-memory evaluation copy substitutes `need-only` target IDs only for the candidate replay.

## Four-way comparison

The output compares:

- **Quick** — frozen member probabilities before Deep evidence impact;
- **current-target Deep** — the original production-parity target set;
- **need-only-target Deep** — the candidate 12-person target set;
- **discovery-all** — the chamber-wide evidence-availability ceiling, not a proposed production policy.

The current and candidate scenarios use the same 12-person per-vote budget. All three Deep scenarios consume the same frozen candidate/source artifacts and run through the unchanged production machinery already validated in the prior impact replay:

- `HistoricalArchiveDeepResearchProvider`;
- `evidenceImpactPolicy`;
- `applyEvidenceSignals`;
- impact version `logit-evidence-v1`.

No evidence coefficient, source-quality weight, relevance weight, confidence value, or probability threshold is tuned here.

## Metrics

For every Deep scenario, the artifact reports:

- requested targets;
- frozen candidate observations available to those targets;
- evidence items returned/applied/excluded;
- affected and probability-changed members;
- decisive member pairs with evidence;
- corrected and harmed Quick classifications;
- classification flips;
- all-member and evidence-affected-member accuracy, Brier, log loss, and ECE;
- per-case diagnostics.

Member-level metrics remain primary. Chamber passage metrics are intentionally not mixed into this evaluation.

## Guardrails

This workstream remains evaluation-only:

- no hindsight web search;
- no outcome data during target selection or evidence extraction;
- prior-day historical cutoff remains unchanged;
- immutable official/archive provenance and SHA-256 content binding remain required;
- non-actionable evidence remains unable to change probabilities;
- no database writes;
- no production target change;
- no evidence-weight tuning;
- no production probability or serving change.

A favorable six-vote pilot result is evidence to expand archive-safe coverage, not sufficient evidence by itself to deploy a new production selector.
