# Historical Deep pilot source catalog

## Purpose

The chamber-wide discovery manifest defines **who** may be examined at each historical cutoff. This source catalog defines the first frozen official corpus the discovery layer is allowed to examine.

The catalog is intentionally small and conservative. It begins with sources that have durable historical identity and a publication date strictly before each pilot vote:

- exact Office of the Revisor bill-text versions;
- exact Minnesota House committee meeting records.

The first bundle covers all six close-vote pilot bills and contains at least two independently identified official sources for every case.

## Why these sources

The target-selection audit and strategy bakeoff show that historical Deep must discover evidence outside the current 12-person target set. At the same time, replay integrity prohibits using present-day web search results as though they were the historical information environment.

Exact Revisor version pages and House committee meeting records provide a useful first corpus because they are date-addressable official legislative records. They can be fetched today, content-hashed, and bound to a pre-vote publication date without importing a current bill-status summary or post-vote search result.

## Catalog validation

`src/evaluation/historical-deep-source-catalog.ts` fails closed unless:

- every source belongs to one of the six stable pilot cases;
- every pilot case has at least one cataloged source;
- every publication timestamp is strictly before the vote date;
- every URL uses HTTPS and an approved official Minnesota legislative host;
- Revisor sources use an exact `/versions/<n>/` bill-text URL;
- House committee sources use an exact `/committees/minutes/<committee>/<meeting>` URL;
- source IDs and URLs are unique;
- each record includes page-identity markers that must be present in the fetched content.

These URL rules deliberately reject mutable Revisor bill-status pages and generic House committee archive listings.

## Collector

`scripts/collect-historical-deep-pilot-sources.ts` fetches the checked-in catalog serially with a VotePredict user agent. For every response it verifies:

- successful HTTP status;
- HTML content type;
- non-empty content no larger than 5 MB;
- redirect remains on an approved official host;
- all expected identity markers appear in the rendered page text.

The collector then records:

- original and final URL;
- fetch timestamp;
- HTTP status and content type;
- byte count;
- SHA-256 of the exact response bytes;
- exact HTML content.

The resulting `historical-deep-source-bundle-v1` JSON artifact is therefore a frozen input for later extraction work rather than a set of live URLs that can silently change during evaluation.

## Important timing detail

Some Revisor version pages display a current rendering timestamp near the page header that does not match the historical version-list publication date. The catalog uses the version-list posting date associated with the specific engrossment, and the exact version URL plus expected markers bind the fetched bytes to that version.

No source dated on the vote day is allowed. The replay stores day-level vote dates rather than exact floor-vote times, so same-day sources are excluded even when they may have been published earlier in the day.

## What this PR does not do

The source bundle does **not**:

- search the open web for evidence;
- infer a member's stance;
- extract evidence items;
- change Quick or Deep probabilities;
- change production targeting;
- write to the database.

The next step is an outcome-blind discovery extractor that scans this frozen corpus for explicit member mentions/actions and produces candidate evidence with exact source/excerpt binding. Those candidates must then pass the existing `HistoricalArchiveDeepResearchProvider` validation before any Deep-vs-Quick replay is scored.
