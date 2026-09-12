# Historical Deep archive provider

## Purpose

Historical Deep must answer a stricter question than live Deep: **what evidence could the research layer have known by the historical forecast cutoff?**

A present-day web search with an `asOf` instruction is not sufficient for this evaluation. Search rankings can contain hindsight, pages can change, and a current page describing an old event does not prove that the same content was available before the target vote.

`HistoricalArchiveDeepResearchProvider` is therefore offline-only. It accepts prebuilt, frozen evidence packets and performs no network discovery itself.

## Packet schema

Schema version: `historical-official-archives-v1`.

Each packet is bound to one exact replay target:

- forecast/replay ID;
- bill or proposal ID;
- chamber ID;
- exact `asOf` cutoff;
- source records;
- extracted member-level evidence.

The provider rejects packet/request mismatches rather than adapting a packet to a different forecast.

## Allowed provenance

### `official_historical_record`

Use for date-addressable official legislative records whose record date is part of the historical source itself. Initial Minnesota candidates include:

- House Session Daily archive articles;
- House and Senate journals;
- legislature-specific Revisor records and dated bill-version pages.

The source must include:

- canonical HTTPS URL;
- historical publication timestamp at or before the replay cutoff;
- SHA-256 of the material used for extraction.

The packet builder is responsible for limiting this class to sources where the historical date is meaningful and the official record is intended to preserve the historical record. A current mutable biography, landing page, or search-results page does not qualify merely because it is hosted on an official domain.

### `archive_snapshot`

Use for a page frozen by an independent archival snapshot.

The source must include:

- canonical HTTPS source URL;
- exact HTTPS archive-snapshot URL;
- source publication timestamp at or before the replay cutoff;
- archive capture timestamp at or before the replay cutoff;
- SHA-256 of the captured material used for extraction.

A snapshot captured after the target vote is rejected even when the page claims an earlier publication date. This intentionally favors false negatives over hindsight leakage.

## Fail-closed rules

The provider rejects the packet when any of the following is true:

- packet schema is unsupported;
- forecast, chamber, bill/proposal, or exact cutoff differs from the research request;
- source URL is invalid/non-HTTPS;
- content SHA-256 is missing or malformed;
- source publication is after the cutoff;
- archive snapshot is missing a valid archive URL/capture timestamp;
- archive capture is after the cutoff;
- evidence points to an unknown source;
- evidence lacks a target membership;
- evidence targets a member who was not selected by the Deep targeting planner;
- confidence is outside `[0,1]`.

The provider does not silently drop invalid rows and continue. A contaminated packet invalidates the replay request.

## Actionability

Every extracted evidence row must make `mechanicallyActionable` explicit. The provider copies that decision into durable evidence metadata along with source verification, cutoff status, provenance kind, canonical URL, archival URL/capture time when applicable, and source content hash.

The separate evidence-policy safety change that honors `metadata.mechanicallyActionable === false` must be present before these packets are used with the probability-impact engine. This keeps context in the evaluation artifact without allowing context-only evidence to change a member probability.

No actionability decision in this provider changes the existing evidence weights. Weight tuning remains frozen until paired Deep-vs-Quick evaluation exists.

## Discovery discipline

The initial historical research corpus should be built from predefined official archive collections rather than present-day search-engine results. That avoids a subtler form of leakage where modern search ranking tells the evaluator which old pages turned out to matter.

A later expansion may add independently archived web material, but only when a snapshot itself predates the replay cutoff.

## Next implementation layer

The next builder should:

1. take the leak-safe replay cohort and exact selected Deep targets;
2. enumerate only predefined historical official archive collections for the target session/date;
3. fetch and freeze qualifying source material;
4. hash the material;
5. extract source-backed member evidence with explicit actionability;
6. write deterministic `historical-official-archives-v1` packets;
7. run `HistoricalArchiveDeepResearchProvider` against the exact historical Quick base;
8. score paired Quick/Deep observations with `eval:deep-vs-quick`.

The packet-building step should be reproducible and separately auditable from probability application.
