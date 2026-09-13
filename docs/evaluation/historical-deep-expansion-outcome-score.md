# Historical Deep expansion post-discovery outcome score

## Purpose

This stage is the first point in the 24-event expansion where later floor outcomes are allowed to enter the experiment.

Everything outcome-sensitive happens only after three earlier artifacts are already immutable:

1. the 24-event cohort;
2. the chamber-wide pre-vote Quick manifest and both 12-person target sets;
3. the deterministic procedural candidate artifact extracted from the frozen official archive.

The scoring stage does not change targets, evidence, probabilities, weights, or database state.

## Post-discovery gate

`data/evaluation/historical-deep-expansion-scoring-lineage-v1.json` pins:

- merged-main candidate artifact run `34727923763`, artifact `10308141732`, SHA-256 `c752a3885921d086609b11e815cb7e122ba36a8521cb4d091c6c54aac8cdd4eb`;
- frozen discovery manifest run `34727649103`, artifact `10308004770`, SHA-256 `084c5d38b41ef8532e67a076c585fd9e9e36e14babe9c8fc2dbebd20e1313cb0`.

The workflow verifies both artifact digests and verifies both artifacts are outcome-free **before** waiting for/deploying the outcome operation or reading the production operation secret.

The outcome request embeds the exact candidate run/ID/digest/SHA. The returned snapshot repeats that lineage, so later offline replay can verify that the outcome labels belong to a post-discovery freeze.

## Exact event lookup

The protected production-only route receives the already-frozen 24-event discovery manifest. For every event it queries only the exact frozen `voteEventId` and revalidates:

- source-derived `externalKey`;
- bill identifier;
- session;
- chamber;
- floor-vote date;
- passage-vote status.

It does not search for a bill/date replacement. If the exact event is absent, duplicated, has drifted, or is no longer a completed passage vote, the run fails.

## Member outcomes

Only decisive official `YEA` / `NAY` member choices are frozen. Membership UUIDs are retained for provenance, but subsequent candidate scoring joins by the stable legislator identity within the exact frozen event.

A member without a decisive floor choice is intentionally absent from the decisive outcome map and remains visible as `no_decisive_floor_outcome` if a frozen candidate exists for that legislator.

## Signal scoring reuse

The expansion scorer does not introduce new procedural direction rules. It adapts the expansion candidates/outcomes into the original six-vote scoring shape and calls `scoreHistoricalDeepDiscoveryCandidates` unchanged.

The existing conservative rules therefore remain in force:

- refer/re-refer/recommend-to-pass motions are treated as advancing;
- table motions are treated as impeding;
- ambiguous motions are not directional;
- opposite directional observations for the same member/event are `conflicting`, not cherry-picked;
- high-confidence Quick error and rescue definitions are unchanged.

The expansion wrapper adds only:

- source-derived stable event lineage;
- cohort tranche;
- frozen `need-only` target membership;
- current-vs-candidate target-pair summary counts.

## Guardrails

- Outcomes are introduced only after merged-main candidate freeze.
- No current/general web research.
- No source discovery or extraction after seeing outcomes.
- No target recomputation after seeing outcomes.
- No database writes.
- No production probability changes.
- No evidence-weight tuning.
- No production selector change.

The output of this stage is an immutable official outcome snapshot plus a signal score. A separate offline replay must pin that outcome artifact before applying the unchanged production evidence-impact mechanism.
