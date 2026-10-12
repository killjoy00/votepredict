# #864 Track B — pinned original CFB bulk CSV provenance V4

**Owner request:** pursue all four remaining finance-original recovery tracks: (1) historical candidate contributions raw replay redirect and CDX, (2) candidate expenditures pinned original capture, (3) independent expenditure (IE) historical official download catalog, and (4) protected exact-original-to-stored row parity only after fresh independent CDX body authentication.

This source-only V4 step tackles **1–3 together**. It does NOT connect to Neon or read any private evidence row keys. The exact-row private parity stage (4) is a separate, protected, read-only reviewed stage, conditioned on verified original bytes. #864 stays OPEN; no 2027 activity, database writes, stored-eligibility repair, serving/model/forecast/deployment/scheduler or outreach.

## Historical captured-CSV evidence used to PIN source leads

Two historic research jobs from 2026-10-02, [candidate backfill run 37074044717](https://github.com/killjoy00/votepredict/actions/runs/37074044717) and [IE catalog run 37079088893](https://github.com/killjoy00/votepredict/actions/runs/37079088893), *reported successful parsing of historical CSVs*. That is a lead but **not a newly authenticated raw replay hash**.

The public fixed registry `PINNED_CFB_ORIGINALS` in `scripts/prove-cfb-864-pinned-public-originals-v4.ts` freezes these 10 specific source/capture tuples:

| Family | Official historic selector (download ID) | Exact historical archived capture (UTC) |
| --- | --- | --- |
| candidate contributions | -2113865252 | 2022-06-06 10:24:11 |
| candidate contributions | -2113865252 | 2023-06-12 00:29:07 |
| candidate expenditures | -1890073264 | 2022-06-06 10:30:37 |
| independent expenditures | -115995361 | 2023-08-03 04:31:21 |
| independent expenditures | -1316131999 | 2023-08-03 04:29:03 |
| independent expenditures | -275160089 | 2023-06-12 07:57:19 |
| independent expenditures | -325492613 | 2023-06-12 07:56:57 |
| independent expenditures | -479050468 | 2023-06-12 05:48:39 |
| independent expenditures | -617535497 | 2023-06-12 04:32:06 |
| independent expenditures | 478226068 | 2023-06-12 05:49:17 |

All fixed official historical source URLs use `https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=<id>`. These are PUBLIC historically documented exact selectors, not arbitrary user-supplied URLs. The 2026-10-02 IE catalog had 164 indexed captures / 23 distinct official download URLs, of which seven passed the old 2021–22 IE content-classification and parsed rows; this V4 registry selects seven anchored *successful historical IE source leads*, not all 23.

The 2026-10-12 [V3 transport-only run #38282879580](https://github.com/killjoy00/votepredict/actions/runs/38282879580) returned 6 indexed contributions originals but a 3xx raw replay HOLD; the expenditure index timed out. V4 isolates the already recorded capture identities instead of inferring any first publication date or fetching an unbounded source catalog.

## Independent 2026-10-12 V4 original-body proof gate

For **each pinned original**:

1. Request the existing public `web.archive.org/cdx/search/cdx` CDX metadata index with the *single historical UTC calendar day* and fixed exact official download URL, a maximum of 60 entries / 160 KB. Enforce 200 status, exactly expected index columns, valid 14-digit timestamps, identical official download selector, official CFB hostname/path and a Base32 SHA-1 digest of the exact indexed historical `timestamp`.
2. Fetch the precise `/web/<timestamp>id_/original` original-body replay with `redirect:'manual'`. A 3xx can only be followed within a **hard maximum of two** hops if the target remains `https://web.archive.org`, the **same** exact 14-digit capture timestamp and `id_` replay mode, and the same fixed official CFB selector (allow `http`/`https` source-scheme normalization only). Reject cross-host, site-homepage, different date, altered `download=` selector and oversized locations; never fetch redirect targets outside these constraints.
3. Require complete original response body no more than **120 MB**, with bounded stream/timeout, and recompute **entire untransformed original-body SHA-1 Base32** from bytes. Require **exact match to the independent public CDX capture digest** before parsing; otherwise HOLD. Additionally compute entire original raw-body SHA-256 and parse only 2021–22 CFB source rows with the existing, fixed candidate contribution, candidate expenditure or IE parsers; require at least 25 candidate or 10 IE rows.
4. The public receipt contains ONLY the fixed source-id label, status enum, number of indexed candidates/replay requests, and, **if and only if** all original-body gates pass, indexed digest, public original-body SHA-256, capture calendar day, byte count, aggregate 2021/2022 row counts and distinct/duplicate canonical `rowKey` counts. **No original CSV body, person/vendor/donor, monetary amount, archive response location, private stored row key or parsed raw finance row is logged, uploaded or serialized.**
5. Failures (CDX outage/response/index mismatch, pinned capture not indexed, unsafe 3xx, replay unavailable/digest mismatch/malformed CSV) are per-source **HOLD**, never negative evidence of source existence or transaction count, and never a replacement by a current CFB download.

The source module exposes ephemeral `AuthenticatedPinnedRows` (a set of canonical parser row keys) to a separately reviewed protected consumer; this data must **only ever be used in memory inside the protected read-only matching step**. The public source runner never serializes it.

## Execution and follow-up

This PR adds strictly synthetic URL/redirect/tampering/digest/public parser and safe receipt tests, a unique reviewed merged-main marker `SENATE_864_CFB_PINNED_ORIGINALS_V4_20261012`, independent full repository check, clean disposable PostgreSQL migrations/dependency audit and a first-attempt public-only source job. The workflow receives **no Neon keys, production credentials, artifacts or issue-writer permission**; after its actual job completes, verified fixed finite receipt statuses can be extracted and posted to #864 using GitHub connector.

**Track 4 requirement after 1–3:** separately review a protected `READ ONLY REPEATABLE READ` audit that uses *only fresh authenticated V4 original SHA1/CDX+full SHA256+canonical parsed row keys*, joined **in protected memory/SQL** to the same bounded 500 finance source-doc/64 evidence item first-prefix rule. The aggregate SQL should split (A) verified original source version and archived digest match, (B) immutable captured date parity, (C) exact original source `rowKey` containment, (D) mismatched original or stored proof metadata, and (E) remaining untested archived records. Only finite counts and HOLD labels may leave the protected job; no parsed row keys, donor identities, source URLs, raw hashes from private records or source content. If all V4 originals remain HOLD, source-to-row parity **cannot** be run truthfully, and the protected path must fail closed without database access.

Do not treat a source hit in 2023 as first-publication proof in 2021; historical capture dates remain conservative public-by upper bounds. The 2,448 older filing-derived eligible observations remain separate report-original/amendment/PDF public-by research and are NEVER upgraded by a CSV archive hit.
