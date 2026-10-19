# #946 — verified actual Common Crawl alternative historical original source results

**October 18, 2026 Central time / October 19 UTC.** Public-only source research requested by owner. The implementation [PR #1457](https://github.com/killjoy00/votepredict/pull/1457) is merged at main `36736f6b9e9ad5b0b6fb4edd18674a0fd4c0b693`. All independent offline tests, full PR CI [#39198845068](https://github.com/killjoy00/votepredict/actions/runs/39198845068), preflight [#39198845169](https://github.com/killjoy00/votepredict/actions/runs/39198845169), and postmerge main CI [#39199085387](https://github.com/killjoy00/votepredict/actions/runs/39199085387) **SUCCESS**.

The guarded **real public** alternative archive research [workflow #39199085502](https://github.com/killjoy00/votepredict/actions/runs/39199085502) / job **117888660253** succeeded. GitHub Actions artifact **12162903922**, `senate-946-reformer-seven-original-dated-commoncrawl-v7-metadata`, retains only limited public provenance metadata for 30 days. The permanent source/status receipt is [JSON](senate-946-reformer-seven-dated-commoncrawl-actual-20261019.json).

## Exact dated-URL archive result — no novel original article bodies recovered

14 **fixed** historical monthly Common Crawl CDXJ indexes were queried for the exact HTTPS Minnesota Reformer `/YYYY/MM/DD/` candidate original URLs of seven previously authenticated `/briefs/` articles. Relevant [official Common Crawl collection registry](https://index.commoncrawl.org/collinfo.json) and [original-index/WARC retrieval documentation](https://commoncrawl.org/cdxj-index). Queries were rate-limited, manually no-redirect, bounded, and restricted to the previously reviewed 2021–2025 URLs and historically contemporaneous original copies.

**Actual aggregate:** **0/7** dated publisher original URLs authenticated; **0** original SHA1-verified WARC HTML bodies acquired; **9/14** selected index lookups returned *no exact URL record* for that selected crawl; **5/14** index lookups were *unavailable/unknown*. The latter five do not even establish whether the chosen crawl indexed this URL.

| Existing /briefs/ historical story | Fixed selected CC collections | Exact index results |
| --- | --- | --- |
| 2025-05-01 road signs | 2025-21; 2025-26 | unavailable; no exact record |
| 2022-03-22 DFL public safety | 2022-21; 2022-27 | unavailable; unavailable |
| 2021-07-02 commissioner confirmations | 2021-31; 2021-39 | no exact record; no exact record |
| 2022-06-16 special session | 2022-27; 2022-33 | no exact record; unavailable |
| 2023-02-21 driver's licenses | 2023-14; 2023-23 | no exact record; no exact record |
| 2024-02-12 sanctuary proposal | 2024-10; 2024-18 | unavailable; no exact record |
| 2025-05-06 paid sick leave | 2025-21; 2025-26 | no exact record; no exact record |

**These are selected crawl-index results, NOT proofs any publisher article was never published or the different dated URL did not exist.** Historical coverage may exist in other CC crawls, third-party archives, publisher CMS logs, local caches or externally preserved RSS. The verified 2021–2025 archived original **17 Minnesota Reformer /briefs/ HTML versions** across **13 original publisher URL paths** remain authenticated from [the earlier 22/22 original replay](senate-media-track-d-946-987-22-original-replay-actual-20261018.md). All **seven proposed brief-to-dated historical article identities remain unverified**; no original article-alias merging or published-source completeness percentage is justified.

## Scope and actions

The new [Common Crawl original WARC verifier](../../src/evaluation/senate-946-reformer-exact-commoncrawl-originals.ts) never fetches current publisher pages, MPR episodes, or Wayback. A genuine positive original capture requires a trusted exact full original URL, WARC target/UTC, HTTP 200 HTML, original digest indexed by CC, WARC block digest, payload SHA1 and exact HTTP 206 byte range before outputting any evidence. This pass found **no** qualifying dated originals, so no article text or full bytes were stored or distributed.

No `data/sources/local-trade-news-v1.json`, media path selection, collector, scheduler, database table, evidence row, trained model, retrospective forecast, recorded vote or deployment was changed. Both original issue and parent Track D remain open for any future justified source-proof investigation. Further evidence would need an independently authenticated historical **dated-path** publisher/crawl body and a bounded comparison against the already verified original `/briefs/` body; current redirects and same article slug are not two-sided historical identity proof.

### MPR research date disposition

Per owner direction, this work does **not** continue the MPR chronology investigation. For the selected Grant Hauschild transcript, use **July 2025** as the *first verified available research month*: original printed MPR HTML containing the selected `GRANT HAUSCHILD:` cue by **July 24, 2025 UTC**, independently source-proven original first-party transcript PDF by **July 27, 2025 UTC**. **Do not** treat the selected transcript words as authenticated February 2024 text. July 2025 is not a claim of exact initial publishing date; it is the conservative independently documented observation cutoff, with zero retrospective model promotion.

**Next grounded option if needed:** request a genuine original historical dated-URL body/metadata from publisher or an independent archive outside these 14 specific Common Crawl indexes. Avoid repeating empty indexes as if that could certify a statewide missing-article count.
