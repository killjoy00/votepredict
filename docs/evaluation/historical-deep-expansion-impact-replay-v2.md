# Historical Deep expansion parser-v2 impact replay

This stage measures the probability impact of the already-frozen guarded parser-v2 evidence under the **unchanged production impact mechanism**. It is development-only and offline. It does not query live sources, query the database, alter Deep targets, change evidence weights, update production probabilities, or touch the 2025–26 holdout.

## Immutable inputs

`data/evaluation/historical-deep-expansion-impact-lineage-v2.json` pins five artifacts by run, artifact ID, head SHA, and SHA-256:

1. the 24-event outcome-blind Quick discovery manifest;
2. the official pre-vote source bundle;
3. the guarded parser-v2 candidate artifact;
4. the preexisting immutable floor-outcome snapshot;
5. the canonical parser-v2 signal score.

The outcome snapshot is the same artifact frozen before parser v2 existed. The v2 score was frozen on main before this impact stage. No target, candidate, outcome, or signal is recomputed here.

## What remains unchanged

The replay delegates to the existing expansion replay engine and therefore continues to use:

- `HistoricalArchiveDeepResearchProvider`;
- the existing `proceduralSignal` classifier from the historical outcome scorer;
- `evidenceImpactPolicy`;
- `applyEvidenceSignals`;
- impact version `logit-evidence-v1`;
- the frozen production-current and need-only 12-member target sets.

Parser-v2 candidate objects are preserved at runtime, including their `deterministic-house-committee-roll-call-v2` extraction provenance. Only their outer bundle schema and the outer score schema are adapted so the already-tested replay engine can consume them.

## Ambiguous evidence policy

The v2 extractor intentionally found more named committee votes than the old signal classifier can interpret. This stage does **not** introduce a new direction rule after outcomes are known. A candidate whose motion remains `ambiguous` under the unchanged classifier is converted to no evidence item and cannot move a probability.

That means this replay answers a narrow question: **what would the current production evidence mechanics do if they were fed the newly recovered evidence, without changing their semantics or weights?**

## Scenarios

The replay compares the frozen Quick baseline with three Deep-style evidence scenarios:

- current production targets: 12 members per event;
- frozen need-only targets: 12 members per event;
- chamber-wide discovery: all frozen members, as a diagnostic upper bound rather than a production proposal.

The primary outputs are changed probabilities, corrected and harmed classifications, classification flips, and deltas in accuracy, Brier score, log loss, and ECE over the same decisive member outcomes.

No result from this development replay alone justifies a production selector change, evidence-weight tune, new motion-direction rule, or holdout access.
