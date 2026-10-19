# #946 — seven known Reformer dated-path original sources: alternative Common Crawl WARC audit

**October 18, 2026 (America/Chicago) / October 19 UTC · public-only research.** No production historical seed, collector, scheduler, Neon, evidence-item, recorded-vote, model, forecast, serving or Vercel work.

## Why move beyond Wayback CDX?

The already merged [#946/#987 22-original replay](senate-media-track-d-946-987-22-original-replay-actual-20261018.md) independently reauthenticated 17 historical Minnesota Reformer `/briefs/` **versions**, representing **13 exact original publisher /briefs/ URLs**, alongside the separate MPR episode originals. [PR #1455 actual source-gap audit](senate-media-track-d-946-987-seven-alias-three-pdf-actual-results-20261019.md) queried seven proposed `/YYYY/MM/DD/` dated counterparts against exact Wayback CDX. All seven indexes were `index_unavailable_unknown`. No two-sided historical original alias identity was proved. The provider error is **not** evidence that the dated article URL was never served, nor grounds to invent seven missed articles.

This phase implements only owner-selected **path 1**: try a different independent archive instead of repeating Wayback. In particular, query the official [Common Crawl CDXJ collection indexes](https://index.commoncrawl.org/collinfo.json) and recover original gzip WARC byte ranges when a fully matching original record is reported. [Common Crawl's own WARC/CDXJ documentation](https://commoncrawl.org/cdxj-index) describes the fields `url`, `timestamp`, `digest`, `offset`, `length`, and `filename` and the data host for HTTP byte-range recovery.

## Immutable selected public requests

| Order | Original /briefs/ study | Exact dated-path displayed day | First historical CC index | Second historical CC index |
| --- | --- | --- | --- | --- |
| 1 | 2025 road signs | 2025-05-01 | CC-MAIN-2025-21 | CC-MAIN-2025-26 |
| 2 | 2022 DFL public safety | 2022-03-22 | CC-MAIN-2022-21 | CC-MAIN-2022-27 |
| 3 | 2021 commissioner confirmations | 2021-07-02 | CC-MAIN-2021-31 | CC-MAIN-2021-39 |
| 4 | 2022 special session | 2022-06-16 | CC-MAIN-2022-27 | CC-MAIN-2022-33 |
| 5 | 2023 driver's licenses | 2023-02-21 | CC-MAIN-2023-14 | CC-MAIN-2023-23 |
| 6 | 2024 sanctuary / North Star | 2024-02-12 | CC-MAIN-2024-10 | CC-MAIN-2024-18 |
| 7 | 2025 paid sick leave | 2025-05-06 | CC-MAIN-2025-21 | CC-MAIN-2025-26 |

Original URLs come **exclusively** from previously verified and exactly matched source IDs in the pinned prior [seven historical Reformer alias hypotheses](../evaluation/senate-media-track-d-946-987-seven-alias-three-pdf-actual-results-20261019.json) and `getTrackDHistoricalShadowPins`. All CC collection IDs are in the official historical collection registry. No domain-level search, current publisher requests or new URL candidates are authorized.

Each of **14 exact CC index HTTP GETs** selects at most eight JSONL entries from one **fixed** historical collection. Rows are valid only for the exact HTTPS dated publisher original, HTTP status 200, HTML MIME, checked 2021–2025 capture timestamp on or after the displayed publication day, indexed SHA-1 (base32), and strictly bounded WARC `filename` / offset / range / length. Up to one originally indexed 200/HTML gzip WARC member per collection may be downloaded from `data.commoncrawl.org` with exact 206 Content-Range. Decode in memory with a decompression cap, validate the WARC response URI, archived date, WARC body checksum, HTTP 200 content block and original indexed SHA-1 against raw HTML. Preserve only public source hashes, observed UTC and replay disposition. Mismatches are quarantined; 404/503/invalid index is **UNKNOWN**, not absent publisher article.

A SHA1-verified dated-path original, if found, proves **that exact archived URL and capture**, not the initial posting minute, identical article under a `/briefs/` alias, text spoken by the senator, a vote, or an admissible historical prediction feature. Two-sided text/byline/date source identity comparison and human attributed statement review remain distinct unapproved follow-up tasks. These fourteen selected indices are **not** an exhaustive Common Crawl archive coverage denominator.

## Workflow and controls

Implementation `src/evaluation/senate-946-reformer-exact-commoncrawl-originals.ts`; runner `scripts/run-senate-946-reformer-exact-commoncrawl-originals-v7.ts`; adversarial tests `tests/senate-946-reformer-exact-commoncrawl-originals.test.ts`. PR workflow `.github/workflows/senate-946-reformer-commoncrawl-originals-v7.yml` runs a **keyless, zero-network** preview, original gzip/HTTP/source-SHA replay fixtures, strict timing/URL/tamper checks, full `npm run check` and dependency audit.

The **real** fourteen-query original archive pass runs only from the **first** CI-reviewed default-branch commit containing `SENATE_946_REFORMER_COMMONCRAWL_V7_20261019`, only after independent offline verification is green. Requests are sequential/rate-limited, fail closed, use no GitHub secrets/private database, and never persist raw HTML/WARC/audio/transcript or personal records. A bounded metadata-only expiring Actions artifact and an actual result log allow separately checked-in public receipt if completed.

## MPR disposition (not a second workstream)

At owner direction, stop attempting to prove MPR transcript publication before the independently authenticated **July 2025** historical copies. The selected `GRANT HAUSCHILD:` printed MPR HTML cue is shown in a **July 24, 2025 UTC** archived original and the PDF is authenticated from **July 27, 2025 UTC**. Treat **July 2025 as the earliest verified observation/usable research month** for the selected transcript. This is not a finding that MPR originally created or first published it in July, and **does not permit backdating it to the February 2024 interview**. This #946 phase makes **zero MPR source network requests**.

Keep #946 **OPEN** until dated-path historical original identity is independently established. Keep #987 scope unchanged; do not spend additional audit resources attempting to move the MPR transcript's verified observation earlier without a new owner request.
