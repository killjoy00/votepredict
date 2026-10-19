# #946 / #987: five-year original Wayback replay dry run (public-only, non-production)

**October 18, 2026.** The user authorized steps 1–3: research whether the missing sources were captured elsewhere, design and test an isolated historical-only collection improvement, and check publication/identity/attribution safety. **This change is NOT authorization to update the production collector, source catalog, database, historical forecast, model, votes, scheduler or Vercel.**

## Evidence that precedes this pilot

The actual scoped original read-only coverage [PR #1446](https://github.com/killjoy00/votepredict/pull/1446) and same-snapshot denominator [PR #1447](https://github.com/killjoy00/votepredict/pull/1447) proved zero historical `/briefs/` or `/episode/` original paths within the old 44-seed `wayback_local_trade_news` context (948 evidence items, 805 distinct source docs). The next [cross-ingester protected audit PR #1449](https://github.com/killjoy00/votepredict/pull/1449), actual successful [read-only run #39190098548](https://github.com/killjoy00/votepredict/actions/runs/39190098548) and [permanent report](senate-media-track-d-946-987-cross-source-results-20261018.md) compared public source identifiers to **63,594 source documents across all 46 stored source types, and 344,016 evidence items**, finding no exact archived source URL, original URL, raw historical body SHA or seven known dated-alias URL metadata references for **23 historical archive-version proofs**. Those 23 original *versions* span 17 publisher original URLs, **not** 23 distinct missing news articles. Completely different source labels and semantically similar prose elsewhere remain outside that exact match.

The prior [offline historical shadow proof](../../src/evaluation/senate-media-track-d-historic-shadow.ts) safely outlined two missing public source URL families. This follow-up adds **real public Wayback original replays under a one-shot, reviewed-main, unprivileged workflow** and a deterministic *non-production source-version* preview. The live canary selects five exact historical captures, using previously independent CDX indexed SHA-1 and original raw body SHA-256 receipts, instead of discovering new URLs or changing scheduled ingesters.

## Isolated research-only candidate collection

| Property | Historical-only dry-run policy |
| --- | --- |
| Reformer proposed URL family | `https://minnesotareformer.com/briefs/`; publisher-displayed **2021–2025** |
| MPR proposed URL family | `https://www.mprnews.org/episode/`; publisher-displayed **2021–2025** |
| Actual production media prefixes | Still `https://minnesotareformer.com/202` and `https://www.mprnews.org/story/202`; not changed |
| Actual production topical path gate | Evaluated independently; not changed or automatically bypassed |
| Distinct archived HTML **versions** in reviewed research queue | **22** (17 Reformer / 5 MPR episodes); one MPR `/story/` control excluded |
| Distinct publisher URL paths in research queue | **16** (13 Reformer / 3 MPR episodes) |
| Candidate historic Reformer brief/dated alias relationships | **7**; **zero** automatically merged or deduplicated between separate original paths |
| Same original URL, different original archive UTC or body SHA | Separate immutable research-only version keys; a separate same-original publisher-URL/day family key avoids pretending two snapshots are two distinct *articles* |
| Historic UTC | The actual archived original observation, never invented as the initial publisher publishing minute |
| Speaker full quotation, membership and original audio | Explicit pending review; **zero** automatically accepted as verified speech, Senate membership or a recorded vote |
| Retrospective forecast feature | **Never** created or automatically approved from archive dates, speech cues, reporter phrases, current transcript or this pilot |
| Source write, new seed, live scheduler, retrain, forecast or deployment | **None** |

Five immutable original `id_` Wayback URLs are the public network canaries (one historically displayed publisher year each): **2021 Reformer rent control, 2022 Reformer public safety, 2023 MPR Kunesh family preservation, 2024 MPR Hauschild North Star Act, 2025 Reformer road signs**. The script sends **at most five sequential requests** to the original Internet Archive replay endpoint, spacing subsequent attempts, and **never** attempts a direct publisher website, alternate nonapproved host, audio service, private source, arbitrary new URL, an unbounded archive discovery query, new personal data collection or a redirect follow. It respects the archive's access/robots restrictions (blocked or unavailable archives remain unavailable; no workaround). Strict existing `verifyMediaPublicCdxReplay` checks manual redirects, HTTP status, MIME type, a 2.5 MB body ceiling, exact public original URL/capture timestamp and indexed WARC payload SHA-1 before its raw-body SHA-256 is compared to the **separately previously verified** exact original. The original bytes are never returned to callers or written to disk, CI artifacts or logs. An unavailable replay remains **UNKNOWN**; differing indexed-original SHA or raw-body SHA is **QUARANTINED**, not counted as a new article or historical evidence; a matching raw SHA confirms only that exact archived HTML copy was reauthenticated. A green audit job does **not** imply every network request succeeded; inspect the counters in its printed bounded metadata receipt.

## As-of and identity regression examples

- **MPR Grant Hauschild Feb 19, 2024:** original HTML was historically archived that day, but the selected named interview wording was only demonstrated in a **July 24, 2025** original copy; source-page availability cannot backdate the particular later transcript wording to Feb 2024. The timestamp test independently guards these two clocks.
- **MPR Mary Kunesh Feb 7, 2023:** selected named-turn phrases were first original-HTML-verified by the archived **Feb 10** copy, not automatically when the Feb 7 interview aired. The Oct 22, 2024 Kunesh charter-school page lacks a selected transcript cue that appears in the Dec 11 version; no earlier prediction feature is created.
- **Reformer Apr 30, 2025 Keri Heintzeman:** the article predates the **May 6 Senate oath**. The dry run cannot treat the article as a statement by an already serving senator solely because she was later sworn in.
- **Reformer brief vs dated URL aliases:** currently shared headline/slug, 2026 redirect, reporter text overlap or one-sided canonical metadata does not prove identical historical archived original bytes. No version/article identity is auto-merged across two URLs without independent authentic historical source comparisons.
- **Current-path topical priority:** a historical verified archive source entering the proposed research queue is **not** an automatic evidence item. A later capture implementation must separately check the archived visible article text, reviewer attribution and valid source-first observation cutoff; the general live topical path scoring cannot prove this.

## How to verify without changing production

- On a PR, the **keyless** workflow `.github/workflows/senate-media-track-d-original-replay-canary-v4.yml` checks all 22 offline candidates, the five immutable public canary URL/hash IDs, historical cutoffs, alias/version keys, quarantined replay behavior, 2026 rejection and no model/DB side effects. Full repo `npm run check` and dependency audit run as separate steps.
- A deliberately marker-named, reviewed `main` merge commit performs the same independent offline checks, then once launches five real **public only** Wayback replay requests. No GitHub secrets, Neon connection, authentication token or environment with database access is used in this workflow. Source bytes are never committed.
- Offline preview can run `node --import tsx scripts/replay-senate-media-track-d-historical-canaries.ts --preview`; only after the protected reviewed-main guard may `--network-canary` fetch fixed archived original public URLs.
- Source count does not determine article completeness or timestamped individual senator quote count. Later source ingestion requires **separate explicit production activation authorization**, idempotent dry-run-to-write verification, robots/archive rate caps, two-sided alias proofs, original capture integrity and a bounded rollback plan. No such activation is part of this PR.

Both [#946](https://github.com/killjoy00/votepredict/issues/946) and [#987](https://github.com/killjoy00/votepredict/issues/987) remain OPEN. Historic media collection and vote forecasting are untouched.
