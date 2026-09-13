# Historical Deep archive expansion cohort

## Why this exists

The first six-vote close-House pilot shows that useful frozen official procedural evidence can improve Quick when it reaches the right member, and the `need-only` selector outperforms the current targeter on the small frozen impact replay. Six votes are not enough to change production targeting.

The next archive tranche must therefore be chosen **before** looking for new committee evidence. Otherwise source availability itself could become a hindsight selection rule.

This cohort freezes 24 additional Minnesota House passage-vote events using only leak-safe historical Quick fields and stable source/bill/session/chamber/date metadata. It does not collect sources, extract evidence, load floor outcomes into cohort selection, alter production targeting, or tune impact weights.

## Development-only boundary

The first expansion uses only:

- session `2021-2022`;
- session `2023-2024`;
- chamber `house`.

The six original pilot cases are excluded. `2025-2026` is intentionally excluded from this archive expansion/tuning stage.

## Two predeclared tranches

Each development session contributes six cases to each tranche, for 24 cases total.

### Deterministic uniform

Six cases per session are selected first by a stable hash of the source-derived event key. This is the representative tranche. It is frozen before the stress-test tranche so selector disagreement cannot bias it.

### Selector disagreement

After removing the deterministic-uniform cases, six cases per session are chosen by the largest disagreement between the 12-person `live-current` and `need-only` target sets. Stable event-key hashing breaks ties.

This tranche is an outcome-blind stress test of the exact product question: does removing the pivotality multiplier route the same 12-person research budget to materially different members where archive evidence can help?

## Outcome leakage guard

The cohort generator deliberately separates reconstruction from selection:

1. Historical Quick is reconstructed with the existing strict pre-vote replay.
2. Before either target selector runs, every member `actualOutcome` is removed from the selector input; event `actualYes` and `passed` are neutralized as well.
3. The stable-metadata query loads only vote-event ID, source-derived `external_key`, bill identifier/title, session, chamber, and vote date. It does **not** select passage outcome, yea/nay totals, or member choices.
4. The emitted cohort artifact contains no floor outcomes.
5. Tests verify that flipping all later floor outcomes leaves the target sets and disagreement score unchanged.

Cohort selection may therefore be rerun reproducibly without using the later result of the vote.

## Stable event identity

The original six-case pilot could use this bill/date key because those hand-picked cases were unique:

`session | chamber | normalized bill identifier | occurredOn`

The broader historical corpus exposed same-bill, same-day multiple passage rows (for example, multiple recorded events can exist for one bill on one date). The expansion therefore keeps that bill/date key as `caseKey` for pilot exclusion and human-readable lineage, while using the historical vote store's source-derived `external_key` to distinguish vote events:

`session | chamber | external_key`

`vote_events.external_key` is constrained unique within session/chamber by the historical schema. For Minnesota House ingestion it is deterministically built from the session key, bill identifier, vote date, journal page when available, and the event ordinal on the official bill vote page. It is therefore a stable non-outcome discriminator rather than a generated database UUID.

The database `vote_events.id` UUID remains runtime lineage only and is not the cohort-selection identity.

## Archive collection after freeze

Only after this artifact is frozen should a follow-up source catalog enumerate exact official pre-cutoff URLs for the selected cases. The existing source rules remain in force:

- approved Minnesota House/Revisor official hosts only unless a separately validated archival class is added;
- exact historical URLs rather than search-result rankings;
- source publication/capture strictly before the floor-vote date under the current prior-day cutoff;
- expected-marker validation;
- SHA-256 content binding;
- immutable frozen artifact lineage;
- no current web search treated as historical evidence.

If a selected case has no qualifying official pre-cutoff record, that absence is itself part of the evidence-availability result. The case must not be silently replaced with one that is easier to source.

## Production isolation

This work adds an authenticated evaluation operation and artifact workflow only. It does not change:

- the production Deep selector;
- the 12-person live research budget;
- evidence weights or `logit-evidence-v1`;
- forecast probabilities;
- persisted evidence;
- database state.
