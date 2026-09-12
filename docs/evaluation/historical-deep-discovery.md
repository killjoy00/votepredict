# Chamber-wide historical Deep discovery

## Why this layer exists

Historical evaluation showed that the current 12-person Deep target selector is a bottleneck before research even begins. Across the full replay it captured only about 10% of Quick classification errors and about 6% of high-confidence errors. A follow-up chronological bakeoff showed that simple 12-person ranking rules trade off two different failure modes:

- uncertainty/need targeting captures substantially more ordinary Quick errors but misses high-confidence errors;
- confidence-challenge targeting captures more high-confidence errors but very few ordinary errors;
- a fixed mixed ranking does not solve both modes.

The evaluation therefore needs a two-stage design rather than another hand-tuned 12-person ranking formula:

1. cheap, outcome-blind discovery across the full active chamber using frozen pre-vote sources;
2. expensive Deep research only after discovery identifies members or evidence that justify the limited research budget.

## Discovery manifest

`src/evaluation/historical-deep-discovery.ts` builds an evaluation-only manifest for the same six close-vote historical pilot cases used by the Deep replay workstream.

For each case it includes:

- stable bill/session/chamber identity;
- the strict pre-vote cutoff;
- Quick model/version lineage;
- every active member represented in the leak-safe Quick replay;
- each member's Quick probability and support quality;
- a flag showing whether the current production selector would place the member in the 12-person Deep set;
- a chamber-wide `DeepResearchRequest` that can be used as the identity contract for offline source collection.

The discovery member objects and request intentionally do **not** contain actual vote outcomes, passage results, post-vote evidence, or any score derived from the result being evaluated. Tests assert that `actualOutcome` is absent from serialized discovery data.

## Source-collection boundary

The discovery request is an identity and cutoff contract. It must not be sent to the live web research provider for historical evaluation.

Historical discovery must use frozen or independently verifiable pre-vote material. Preferred source classes are:

- dated Revisor bill-text versions;
- House and Senate journal entries dated before the cutoff;
- dated committee minutes, hearing records, or roll calls;
- dated Session Daily historical articles;
- member-primary pages only when an archive capture itself predates the cutoff.

Every collected document must retain a trustworthy publication date, canonical or archived URL, exact content hash, and provenance category. Sources dated on or after the vote date are rejected because the stored vote event has day-level rather than time-of-day precision.

## Mutable pages are not historical evidence

Current bill-status pages or other mutable pages must not be snapshotted today and treated as historical evidence merely because they describe older events. They can contain later actions, summaries, amendments, vote outcomes, or other retrospective information.

The packet builder must therefore prefer immutable/date-addressable records and fail closed when publication timing cannot be proven. A current page is only usable when the specific historical content is itself separately timestamped and the collector can isolate the pre-cutoff record without importing later state.

## Relationship to the archive provider

The existing `HistoricalArchiveDeepResearchProvider` is the enforcement boundary for replay packets. Discovery/source collection must produce packets that satisfy that provider's requirements, including:

- exact request identity and cutoff binding;
- `publishedAt <= asOf` (with this workstream using the stricter prior-day cutoff);
- approved historical/archive provenance;
- SHA-256 content binding;
- archive capture timestamp no later than the cutoff when an archive snapshot is used;
- evidence membership scoped only to members present in the request.

The provider remains offline and deterministic: it validates supplied packets and never performs live network research.

## Current-production target flag

`selectedForCurrentDeep` and `currentDeepTargetIds` are included only for comparison. They do not narrow discovery and must not be used to exclude chamber members from source collection.

This is deliberate: the point of the discovery stage is to give members missed by the current target formula an opportunity to surface through pre-vote evidence before the expensive research budget is allocated.

## Guardrails

This workstream is evaluation-only:

- no live research calls;
- no model or evidence weight changes;
- no changes to production Deep targeting;
- no production forecast probability changes;
- no database writes;
- no post-vote data in discovery records.

The next workstream is the deterministic archive source catalog and packet builder for this manifest. Only after archive-backed discovery is measured should a production two-stage targeting design be considered.
