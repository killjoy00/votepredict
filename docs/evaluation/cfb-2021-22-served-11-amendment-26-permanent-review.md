# #864 finance — 26 official amendment versions, 25 first-page-authenticated reports, one explicit HOLD

The original 2022 CFB candidate reports-tab source ledger identified **26 amendment-version references** for **11 actual Minnesota state senators** with **42 independently verified original-version parent PDF reports**. [Merged acquisition #1030](https://github.com/killjoy00/votepredict/pull/1030) requested every exact official amendment version by CFB report ID, and three independent source observations returned **26 different original PDF binaries**, the **same SHA-256 hash and byte length for each across all three runs**, with immutable original-source and Board-receipt metadata. See the [permanent 26-row source ledger](source-proof/cfb-2021-22-served-amendment-26-pdf-source.psv) and [original source checkpoint](source-proof/cfb-2021-22-served-amendment-26-source-checkpoint.json).

## What is actually proven

| Source outcome | Count |
| --- | ---: |
| Distinct original CFB amended-version viewer references | 26 |
| Source PDF binaries actually retrieved and independently SHA-pinned | 26 |
| Authenticated amended **campaign finance report first pages** and Board receipt dates | **25** |
| Official CFB-linked PDF with **unverified normal amendment report identity** | **1 HOLD** |
| Fully authenticated parent-to-amendment *revision chains* for every 26-version case | **No** |
| Independently proven historical public-by dates for these amended PDFs | **0** |

Amendment classes: **10 references for 2021 year-end**, **12 for 2022 year-end**, **2 for 2022 pre-primary C**, **2 for 2022 pre-general E**. Each of the twenty-five authenticated amended documents has an independent original PDF SHA-256, report office/registration/period, original or independently verified redistricting-related Senate district label, Board receipt date, and an amended binary different from its original PDF and other versions. Date-only legal/publication *not-before* bounds were computed, not independently observed actual historical disclosures.

The [original source run #38110090051](https://github.com/killjoy00/votepredict/actions/runs/38110090051) completed its source-only job successfully on PR head `3b921279c9d01cd1a5eef46156bf4590e2ce0c1a`, after [full CI #38110090069](https://github.com/killjoy00/votepredict/actions/runs/38110090069) passed. GitHub Actions metadata artifact **11691073805** has **8,925 ZIP bytes** (SHA256 `ebe280d2560cfa5e4a1093aab4eaf2bba2dc1acebc17eadfc5edf24d094e4931`) and **83,581 JSON bytes** (SHA256 `046c78504a1c2d0196d23b7acac1f57c281d1852e5522749d01b8f7a8d64aa3b`); expires November 10, 2026 UTC. Two earlier original source runs [#38109788636](https://github.com/killjoy00/votepredict/actions/runs/38109788636) and [#38109917993](https://github.com/killjoy00/votepredict/actions/runs/38109917993) returned the **same 26 underlying PDF fingerprints and observed Board dates**, even though their initial strict all-26-complete job condition failed because of the held document. The success of the last job signifies **25 authenticated forms plus one exact documentary hold, not 26 forms authenticated**.

The permanent 26-row provenance PSV has **4,321 UTF-8 bytes** including final LF, SHA256 **`293dcebac622da4ccaa4a5c9ccc3f067ecd9bea005a3b472bcf48856c3fb5891`**. It preserves every official original-version/parent-version pair, original PDF binary SHA, byte count, actual October 11, 2026 UTC acquisition instant, independently verified amended Board receipt date when available, original printed Senate district, conservative *not-before* bound, and strict **AUTH** or **HOLD_HEADER** status. No raw PDF bytes, full text, donor information or transaction amounts are in the permanent metadata.

## One precise unresolved original document

**Aric Putnam — 2021 year-end original amendment version 1**, source key `18430:21:pcc:YE:0:1`, is returned by the official CFB viewer with a distinct **128,524-byte original PDF** SHA256 `7529ad0bf417548f1617d2bb2b74e5115855844df4a979fdbb6ad3e5e6420acf`. Its 1,836 extracted PDF characters include **none** of the standard principal-campaign report title, committee registration label, Senate office/district, reporting coverage, or Board received stamp. That does **not** establish the source is invalid, a nonfiler, or that it has no legally meaningful amended content. It prevents us from **authenticating it as a normal amended finance report** under the same strict identity rules as all others. Do not substitute amendment index or the parent report's dates to manufacture a source receipt date.

Putnam's **2021 year-end amendment version 2** has its own separately authenticated first page and Board receipt date **February 4, 2023**, but the **complete version 1 → version 2 revision chain remains unverified**. We preserve both actual viewer PDF hashes and keep the version 1 identity HOLD explicit.

## Why separate historical versions matter

A particularly meaningful verified later revision is **Gene Dornink's 2022 year-end amendment version 2**, original CFB report key `18058:22:pcc:YE:0:2`. Its first-page Board receipt is **April 30, 2024**. Its conservative date-only public *not-before* is **May 1, 2024**. That later amended report must not be used to reconstruct a 2023 prediction snapshot simply because its report year was 2022. Likewise, amended receipts do not automatically prove the exact historic public-by timestamp.

Outstanding finance Track A: obtain independent first-party source identification for Putnam's unusual document, expand original report/amendment acquisition to other actual senators, and reconcile original-source versions/financial records with VotePredict's actual contribution and expenditure data when authorized. Track B legally owed filing counts and historical active committee denominators remain **unknown**, not zero, and must not block acquisition.

**No changes to production database, predictions, frozen evaluation, serving, scheduler, model, or 2027.** No outreach to agencies, senators or campaigns. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) **OPEN**.
