# Historical Deep expansion parser-v2 outcome score

This stage scores the already-frozen guarded parser-v2 candidate artifact against the already-frozen official floor-outcome snapshot. It does not query production, discover sources, alter candidates, change target selection, tune evidence weights, write to the database, or change served probabilities.

## Immutable boundary

The scoring lineage in `data/evaluation/historical-deep-expansion-scoring-lineage-v2.json` pins two independent artifacts by workflow run, artifact ID, head SHA, and artifact SHA-256:

- guarded parser-v2 candidates: main run `34731281176`, artifact `10308234950`, digest `41ca3d40144d6b125d618b32577d017d9b9c6c49405da40aaec478c8415274fd`;
- preexisting expansion outcome artifact: run `34728183585`, artifact `10308981046`, digest `0487cbf826c1fe1dcbaf887b2850a94914aa9e8a6fdddcfff73483ef87c92471`.

The outcome snapshot was originally frozen for the v1 expansion candidates and remains unchanged. Its embedded candidate lineage must still point to the original v1 candidate artifact (`10308141732`, digest `c752a3885921d086609b11e815cb7e122ba36a8521cb4d091c6c54aac8cdd4eb`). Reusing that immutable outcome snapshot avoids a new database read after parser v2 was frozen.

## Signal-classifier guard

Parser v2 broadened deterministic extraction formats, not signal semantics. This scoring stage therefore adapts only the v2 outer schema and calls the existing expansion scorer and stable-legislator outcome join unchanged.

In particular, no new General Register direction rule is added here. General Register observations that the existing v1 procedural classifier does not already recognize remain `ambiguous_only` rather than being reinterpreted after outcomes are available. This isolates the effect of extraction coverage from any later signal-definition experiment.

The score preserves each member/event pair's v2 extraction-rule lineage so baseline versus supplemental evidence remains auditable.

## Interpretation

The primary questions are:

- how many of the 190 frozen v2 member/event pairs are directional under the unchanged classifier;
- how often those directional signals agree with later decisive floor outcomes;
- how many frozen Quick classification errors they identify and would rescue directionally;
- whether current production targeting or the frozen need-only candidate targeting actually reaches those useful pairs.

Any probability-impact replay is a later, separate step through the unchanged evidence impact policy. This development-only result does not by itself justify changing production targeting, evidence weights, or probabilities, and it does not touch the 2025–26 holdout.
