# Historical Deep expansion candidate extraction

## Purpose

This stage converts the two frozen, outcome-blind expansion inputs into directional historical Deep candidate observations:

1. the chamber-wide pre-vote Quick member manifest for the already-selected 24 vote events;
2. the frozen official Minnesota House committee-minutes source bundle for those same events.

No floor outcome is available to this stage. No probability is changed and no evidence weight is tuned.

## Parser reuse

The expansion does **not** introduce a second committee-vote parser.

`extractHistoricalDeepExpansionCandidates` adapts the expansion artifacts into the exact input shapes consumed by the original six-vote pilot extractor, then calls `extractHistoricalDeepDiscoveryCandidates` unchanged. That means the same existing `deterministic-house-committee-roll-call-v1` logic still decides:

- whether a motion is a bill-level procedural motion;
- whether a roll call belongs to that motion;
- which AYE/NAY name lines are eligible;
- how explicit and surname-only names are resolved against the frozen chamber roster;
- when a name is ambiguous or unresolved;
- which amendment or unrelated roll calls are excluded;
- candidate deduplication.

After the existing extractor returns, the expansion adapter only reattaches:

- the source-derived expansion `stableKey` / `externalKey`;
- the frozen cohort tranche;
- whether that member belongs to the frozen `need-only` target set;
- the original frozen source-page ID rather than the internal exploded adapter ID.

## Safe adapter boundary

The original pilot extractor keys discovery/source joins by session, chamber, bill identifier, and floor-vote date. The broader raw vote store can contain multiple events for the same bill/date, so expansion cohort selection uses the source-derived `external_key` instead.

Before parser reuse, this extraction stage therefore verifies that the **already-selected 24-event corpus** has unique bill/date case keys. If that ceases to be true, the adapter fails closed rather than silently joining two events.

The currently frozen 24-event cohort has 24 unique bill/date case keys, so this reuse is exact for the selected corpus even though it would not be safe as a global vote-event identity.

## Source pages matching multiple selected events

The expansion source bundle stores each official minute page once and may associate it with more than one frozen event. For the unchanged pilot extractor only, the adapter explodes a page into one in-memory source record per source/case match. Every exploded record carries the same frozen HTML and SHA-256 content binding.

Internal adapter source IDs are removed again in the final expansion artifact; the published candidate and diagnostic rows point back to the original frozen source-page IDs.

## Output

The candidate artifact reports:

- total candidate observations;
- unique member/event pairs with candidates;
- events and source pages with candidates;
- AYE/NAY counts;
- observations touching the current 12-person target set;
- observations touching the `need-only` 12-person target set;
- observations touching both or neither target set;
- deterministic extraction diagnostics.

Each candidate carries the frozen pre-vote Quick probability/evidence quality, member identity, vote side, motion text/excerpt, source digest/URL/date, current-target flag, candidate-target flag, and stable event lineage.

## Guardrails

- No floor outcomes.
- No current/general web research.
- No new source lookup.
- No live Deep call.
- No database access or writes.
- No probability update.
- No production targeting change.
- No evidence-weight tuning.

The output must be frozen before any later floor outcomes are joined for scoring.
