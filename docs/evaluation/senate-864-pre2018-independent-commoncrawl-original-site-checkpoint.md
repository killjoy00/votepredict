# #864 — 2013–2017 independent public originals: three unverified Minnesota Senate websites

**Historical evidence research only; October 12, 2026.** This is an independent *earlier-collection* acquisition route, not a reinterpretation of the already merged 2020/2022 SOS filings or a new campaign-policy evidence corpus.

## Established and unchanged source-audited denominator

- **95** distinct Minnesotans actually served in the Minnesota Senate in 2021–2025.
- **92/95** have at least one independently authenticated original candidate-owned historical site research excerpt.
- **1,285** selected short candidate-owned research excerpts. These are not exhaustive platforms or 1,285 distinct positions.
- Original candidate-owned *Senate* site content is still unauthenticated for **Charles Wiger, 2020 SD43; David Tomassoni, 2020 SD6; Thomas Bakk, 2020 SD3**.
- Pre-2020 publisher and caucus first-person remarks, and other-office campaign pages, remain separate categories. Missing originals must not be translated into an absence of political positions.
- Original 2020/2022 *filed-candidate* export containing the 21-field Campaign Website cell remains unavailable; the official seven-column election-results `cand.txt` has no campaign website column. Three independently whole-original-hashed pre-election SOS State Senate candidate lists are verified but do not authenticate those particular filed website cells.

## Newly selected, nonduplicative self-service route

The prior Common Crawl cross-provider search used selected **2016-44, 2018-43, 2020-29, 2020-34** collections. This bounded addendum instead tests four publicly documented additional independent indexes: **2013-48, 2014-52, 2015-11, 2017-04**. Collection names appear in [Common Crawl's published collection inventory](https://github.com/commoncrawl/cc-crawl-statistics/blob/master/crawlstats.py).

| Exact Senate-person identity | Historical original-domain lead | Current provenance status |
| --- | --- | --- |
| Charles Wiger, 2020 SD43 | `http://www.chuckwiger.com/` | Unverified domain hypothesis; his government legislator page never qualifies as candidate-owned |
| David Tomassoni, 2020 SD6 | `http://www.tomassoni4senate.com/` | Historical domain lead; **2019** independently recovered captures contained unrelated printable-receipt/SEO copy |
| Thomas Bakk, 2020 SD3 | `http://www.tombakk.com/` | Original **2008** snapshots already authenticated as **Governor** campaign, not Senate platform |

Each target is matched against independently pinned original official Minnesota LRL actual Senate service sources and 2020 SOS 67-district election winner/candidate lookup originals. The index must return structured actual Common Crawl JSONL, proper target domain and 2013–17 timestamp, a 200 original HTML status and original indexed SHA1 Base32. If an eligible record exists, one bounded original 206 WARC byte range is fetched and checked against its exact index offset/length, WARC URI/time/payload digest, original HTTP status, complete SHA1/Base32, whole HTML SHA256, and WARC `Content-Length`-bounded HTTP body.

Only **safe original URL, time, SHA digests, limited attribution cues and failure/unavailable classifications** may be retained; never archive source HTML, page prose, candidate personal contacts, or raw government filing records. Full historically observed HTML that happens to mention a person still does **not** prove candidate campaign committee ownership or permit automatic issue-statement attribution.

The new `senate-864-pre2018-independent-commoncrawl-campaign-site-probe.yml` audit runs each lane separately, includes synthetic regression tests for false archive hits and commercial template reuse, and preserves 14-day sanitized proof receipts. A job may pass even with *zero authenticated source pages*. Archive outages remain **unknown**, not proofs of nonexistence.

**Evidence admission state at PR creation:** zero new original candidate-owned Senate sites or statements; **95 / 92 / 1,285 remain unchanged**. Newly acquired original records, if any, require manual named campaign/Senate office and literal unique speech comparison against all existing ledgers before any change to these totals.

### Other verified public research observations

The current Secretary of State [candidate filing website](https://candidates.sos.mn.gov/) is explicitly for the **November 2026** election, not the missing historical 2020/2022 21-field filing source. The [SOS candidate filings data page](https://www.sos.mn.gov/election-administration-campaigns/data-maps/candidate-filings/) distinguishes currently filed candidate files from separate election-results downloads. Independent research also re-identified a candidate-completed 2020 Bakk KAXE interview and 2022 Bill Weber biofuels questionnaire **already covered by merged source ledgers**; neither is a newly retrieved candidate-owned site or a nonduplicated campaign-site statement.

No outside contacts, correspondence, public-records requests, data access bypass, production database operations, prediction/model changes, 2027 election work, or deployed application modifications. Do not close issue #864.

## Actual bounded public archive result — 2026-10-12

All three [original official-government/source audit jobs](https://github.com/killjoy00/votepredict/actions/runs/38296842531) completed **successfully**, including seven offline SHA1/WARC/index safety regressions and original LRL/SOS 2020 actual-person/winner reconciliations. Their 12 public Common Crawl requests returned **HTTP 504**:

| Candidate | 2013-48 | 2014-52 | 2015-11 | 2017-04 | Original HTML verified |
| --- | --- | --- | --- | --- | ---: |
| Wiger | 504 | 504 | 504 | 504 | 0 |
| Tomassoni | 504 | 504 | 504 | 504 | 0 |
| Bakk | 504 | 504 | 504 | 504 | 0 |

**Meaning:** Twelve timed-out archival index responses are not twelve empty original indexes. No actual eligible original CDXJ records were returned, no WARC `206` body range could be requested, and no historical campaign issue text was newly verified. This is **provider unavailability**, not authenticated proof the candidates had no websites, no issues, or no early captures.

Permanent machine-readable [sanitized source checkpoint](../../data/evaluation/senate-864-2013-17-commoncrawl-availability-checkpoint-v1.json) preserves each target/collection HTTP status, official-identity validation, correctly null original hashes, and 14-day research-artifact IDs/digests. The three artifacts are stored in the same Actions run and contain no original HTML, original complete WARC, or candidate personal-contact fields.

**Research conclusion:** Original owned-site coverage still **92/95**, selected short original-site excerpts still **1,285**, unresolved candidate-owned Senate websites still **Wiger, Tomassoni and Bakk**, SOS historical 21-column 2020/2022 campaign website exports still **not recovered**. Do not repeatedly retry the same failing Common Crawl endpoints without independent evidence of archive service recovery; move to genuinely different public self-service evidence and keep all missingness explicitly unknown.
