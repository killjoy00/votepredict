# #864 Track B — independently authenticate July 2022 candidate finance WARC originals (V8)

**Scope:** Public-source-only Minnesota Senate 2021–2025 campaign-finance provenance. No source updates, production/Neon access, donor/transaction export, historical-eligibility adjustment, forecast deployment, schedulers, 2027 or any outside contact. Issue #864 remains OPEN.

## Why this distinct original source exists

The [public-only V7 index probe](https://github.com/killjoy00/votepredict/actions/runs/38305630428) found two previously unknown independently stored Common Crawl 2022-07-04 source-response pointers. Each is a distinct later historical capture of an official CFB candidate bulk-download selector:

| Family | Official download selector | Common Crawl index | Capture day | Index response SHA1/Base32 |
| --- | --- | --- | --- | --- |
| Candidate contributions | -2113865252 | CC-MAIN-2022-27 | 2022-07-04 | MUZRYIIC5EO6SZH55HJZ5R77RSOT5JNK |
| Candidate expenditures | -1890073264 | CC-MAIN-2022-27 | 2022-07-04 | IY4OVW75AC2SDHPMKL5KYDCVQYO7CBBK |

Both are metadata WARC pointers, not yet full-body proof. The index reported CSV-like HTTP 200 and bounded WARC filename/range metadata. The new V8 verifier fetches the **two precise original source-response records only** and independently validates:

1. Fresh bounded Common Crawl index response; exact official CFB selector and correct July 4 capture day; previously known SHA1/Base32 digest; unique exact WARC range pointer.
2. HTTP 206 Range support from the exact Common Crawl WARC object, with precise Content-Range and exact bounded gzip member byte length. Reject range ignored, changing digest, redirect, 404 or unexpected object.
3. Strict bounded decompression and WARC/HTTP response structure. The WARC original target/source identity and date must match index, type must be response, and embedded payload digest must match. Reject foreign URL/capture, truncated/encoded/incomplete HTTP entity, non-CSV, non-200, oversized body, or any digest mismatch.
4. **Whole original response-body SHA1** matching indexed digest, a new independent whole-body SHA256, 2021/2022 candidate parser results and **distinct canonical row-key counts only**. The exact raw data and original canonical row keys are ephemeral in CI runner RAM. No body, donor, vendor, amount or row-key upload or logging.
5. For candidate expenditure copy specifically, compare both complete-body digests and byte length against independently certified **June 6, 2022 V4** original: SHA1/Base32 GMF33XY3X4LNADGCPU52JWEDWRHXE23V, SHA256 6d9d9061a0a4080083b62b352763697852105c10b3ab1d1bef96fea25ce4d00b, 41,138,871 bytes. **A different July digest cannot be used to claim the July file is identical to the V4 June original**; these are different capture versions pending detailed body proof.

The source-public-only [PR CI](../../.github/workflows/senate-864-cfb-public-crawl-originals-v8.yml) runs adversarial synthetic WARC/tamper/truncation/range/redirect tests before the live probe, using npm-pinned parsing dependencies. It has read-only GitHub contents permission, zero secrets, no private database, no scheduled events or write permissions, no original-finance artifact upload. The source script has fixed input source IDs and no user-supplied URL arguments.

Run locally (public-only):

    node --import tsx --test tests/cfb-864-crawl-original-bytes-v8.test.mjs
    node --import tsx scripts/prove-cfb-864-commoncrawl-original-bytes-v8.mjs

**Result interpretation:** a verified independent July 4 Common Crawl original means the public source HTTP entity body was independently authenticated and parsed from Common Crawl for **no earlier than this observed July 4 archive snapshot**. It is not proof of exact June 2022 original, not evidence that a particular private stored transaction exists or matches, not the first public release timestamp, and not certification of legally required/amended report-version publication. Retrieval / verification HOLDS do not imply missing records or zero transactions. A different 2023 current cleaned dataset may corroborate contents only at its own evidenced date.

**Next gate after successfully authenticated original bodies:** separate reviewed, unique first-attempt merged-main **read-only** comparison of *these specific exact source capture versions only*, against private evidence using bounded in-memory canonical keys, single read-only repeatable-read transaction, count-only source-specific metrics and explicit rollback. Do not reuse/retroactively bless previously stored Wayback-labelled June 2022 source claims by matching a July 2022 different file: as-of eligibility remains unchanged absent separate review and authorization. V5 101/101 IE bounded proof unaffected, and the 909 candidate expenditure/1,140 contribution archive-labelled observation debt plus 2,448 older filing-derived sample records persist until source-and-date-specific verification.

The separate statewide Senate filer-year duties, amendments, 2023–25 report public-by evidence and complete statewide denominator remain distinct unresolved tasks.


## First live whole-original attempt and documented capture-size barrier (2026-10-12)

The public-only [V8 read-only original byte run 38306830106](https://github.com/killjoy00/votepredict/actions/runs/38306830106) completed its adversarial synthetic tests and checked independently indexed public July 4 WARC objects. Its bounded source-only outcome was:

| Original | Source proof status | Specific failure | Original transaction claim |
| --- | --- | --- | --- |
| July 4 candidate contributions | **HELD** | The fetched WARC record explicitly marked itself **WARC-Truncated** | No complete original body or row keys authenticated |
| July 4 candidate expenditures | **HELD** | Public WARC byte-range endpoint returned **HTTP 503** this run | No complete original body or row keys authenticated |

A prior V8 public run did reach the expenditure WARC body but rejected it under full-original integrity criteria; the current more diagnostic run did not reauthenticate it. A failure to download is not an absent historical campaign transaction.

**External documentation materially reduces this route's expected payoff:** Common Crawl's own [errata on truncated content](https://www.commoncrawl.org/errata/content-is-truncated) say captures before March 2025 were capped at approximately **1 MiB**; this includes July 2022. The independently verified V4 June expenditure CSV was **41,138,871 bytes**, far beyond that threshold. A short, independently indexed WARC record can establish an archive capture lead but cannot be used as proof of a **complete, original 41 MB CSV**, cannot be reconstructed from its missing tail, and cannot validate the full original stored-row set. Common Crawl's [WARC truncation documentation](https://www.commoncrawl.org/errata/no-truncation-indicator-in-warc-records) also notes historical caveats about truncation markers. In this case **the contribution WARC explicitly had one**.

**Consequence:** The July candidate Common Crawl pointers remain useful public historical source-discovery metadata, not a practical substitute for full historical candidate CSV original reauthentication. Do not repeatedly re-run protected storage parity using these truncated captures. Prior V4 *June* expenditure original independent proof is unaffected. Prior V6 three held source-to-stored checks remain unverified. More productive next public paths are exact Wayback full-file alternative delivery modes or independently retained raw CFB exports (not TAP's cleaned 2023 derivatives), and separately exact original/amended report-PDF publication and Senate filer-duty tracking.
