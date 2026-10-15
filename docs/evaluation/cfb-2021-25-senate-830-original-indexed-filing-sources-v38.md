# #864 — Minnesota Senate 2021–2025 candidate finance reports: usable official evidence (V38)

**Research checkpoint: October 14, 2026.** This continues the original Minnesota Campaign Finance Board (CFB) source-ledger reconciliation without losing official filings because PDF text is scanned, a receipt-date line is awkward, or the senator uses a familiar first name.

## What is now in the source inventory

| Official CFB candidate-committee reports | 2021 | 2022 | 2023 | 2024 | 2025 | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Distinct indexed original/amended report **version references** | 121 | 346 | 110 | 123 | 130 | **830** |

The source-ledger split is **506 original report-version references + 324 amended references**, for candidate committees associated through the original Minnesota Legislative Reference Library actual-service roster with **95 of 95 people who served in the Senate during 2021–2025**. A filing under a registered person's previous election year still counts as that candidate's indexed report; it does **not** imply they served in that report year.

**480 exact indexed PDF version references have retrieved whole government PDF bodies, representing 476 distinct PDF SHA-256 files.** Four indexed references point to an identical PDF body under another version ID. Another **349 official index-only versions** have not yet had complete PDF bytes obtained, and **one additional indexed Jerry Newton 2021 YE original** has a previous PDF fetch failure. They are ALL retained as official indexed filing source evidence. The 480 PDFs include 36 newly retrieved original report bodies, without depending on successful PDF text extraction. **14 old PDFs have incomplete first-page field extraction**, and one Ingebrigtsen 2022 source has contradictory printed received/period chronology; none is called a missing official filing.

### Recovery from archived original official CFB viewers

The earlier official-source [396 viewer snapshot rows](source-proof/cfb-2021-24-senate-396-original-viewer-source-observations.psv) contained more state-candidate report versions than the old 445-row working panel. Reconciling exact registration, report year, period, special-election flag and amendment index added **276 independently indexed original-viewer references**, split as **18 in 2021, 139 in 2022, 56 in 2023 and 63 in 2024**. Of these, **100 are 2022 pre-primary/pre-general reports**. The signed original index is preserved in the [276-reference source PSV](source-proof/cfb-2021-24-95-serving-senators-276-more-official-indexed-period-references-v33.psv) and [original viewer source audit](../../scripts/audit-cfb-864-721-official-senate-filing-refs-v33.mjs).

For 12 committees associated with senators who actually served during 2025, 24 original **2022 pre-primary/pre-general** PDFs were downloaded. Another 12 **2023–2024 year-end originals** for serving senators were downloaded, producing [36 complete official PDF source SHA-256+size rows](source-proof/cfb-2022-24-36-serving-priority-original-PDF-binaries-v36.psv) and [read-only government source-run checkpoint](source-proof/cfb-2022-24-36-source-original-PDF-byte-SHA-checkpoint-v36.json). Their PDF existence/source binary is proven; their money amounts, contributor transactions and historical public-by remain unknown.

### Newly complete 2025 index coverage for 70 actual-serving senators

The [read-only official 2025 candidate viewer investigation](https://github.com/killjoy00/votepredict/actions/runs/38645535219) successfully queried **all 70/70 senators who served during calendar 2025**, from original CFB **2026 viewer segments**. Its 70 source response SHAs and original exact year-end viewer-version reference lists contain **130 distinct 2025 YE versions**: **21 already in the ledger** and **109 newly indexed official versions (66 originals, 43 amendments)**. These new 109 index links are available in the [2025 addendum](source-proof/cfb-2025-70-serving-senators-109-extra-original-indexed-YE-versions-v38.psv), [70 official viewer snapshot summary records](source-proof/cfb-2025-70-serving-senators-130-original-government-viewer-versions-v38.psv), and [source-run checkpoint](source-proof/cfb-2025-70-original-viewer-109-new-versions-checkpoint-v38.json). Their file bodies were **not downloaded in the viewer-only discovery pass**, and have not been fabricated as authenticated PDF bodies.

**2025 year-end reports may be received and become public in 2026.** An exact government PDF downloaded or first observed in 2026 is not automatically evidence public before a 2025 Senate vote. This inventory is **not** fed into historical as-of forecast eligibility.

### Public profile and use

The [complete 830-version source ledger](source-proof/cfb-2021-25-95-senators-830-indexed-480-downloaded-v38.psv), [95-senator profile source JSON](../../data/cfb-senate-official-filings-2021-25-v38.json), and [offline byte-pinned source reconstruction test](../../scripts/audit-cfb-864-830-official-indexed-senate-reports-v38.mjs) retain all 445 original known source refs and all later 276 + 109 CFB viewer additions. Senator profiles show **all** official report links rather than hiding everything older than eight, distinguishing **pre-primary, pre-general, year-end, special-election, original and amendment** records. They also distinguish "PDF available," "PDF downloaded; contents not yet reviewed," "Listed by CFB; PDF not yet checked," and "Listed by CFB; PDF download unavailable." Official candidate first-name variants remain linked using the original registration/source roster, never fuzzy guesses.

Report amendments are different versions of the same underlying reporting obligation, not additional contributions to sum. Original report-stated aggregate total receipts have been independently double-checked for only [three selected 2022 original-to-final amendment pairs](source-proof/cfb-2022-three-senate-original-to-latest-amendment-receipts-deltas-v31.psv); do not extrapolate the audit to all 830 versions.

## Limits and concrete next work

- **Source index/filing existence:** 830 official report version references associated with 95 actual-serving 2021–25 senator persons. This is a selected publicly recoverable viewer evidence panel, **not the legally required report denominator**.
- **Whole original PDF source authenticity:** 480 indexed versions / 476 unique complete bodies as of V38. Another 349 indexed refs need PDF retrieval; retain them regardless of transport/parser results. Newton 2021 is separately indexed with a held fetch.
- **PDF contents and aggregate financial reconciliation:** only report-specific validated fields can be counted. 14 difficult scans and one contradictory receipt/date are data-quality notes, not exclusion rules. Additional aggregate receipts and expenditures should be reviewed by specific report form/table layout before inferring amounts.
- **Historical publication / voting availability:** no exact full historic 2021–2025 signed PDF version is certified by a matching contemporaneous full-file timestamp. A 2026 indexed viewer and a statutory release floor do not prove what was online before a specific older vote.
- **Statutory reporting obligations:** committee registration effective/termination dates, waivers, report types, legal due/received original counts and statewide denominator remain separately unknown. Do not call anyone a non-filer on the basis of an empty current viewer or a failed binary fetch.

**Safety:** no public-record requests, official outreach, private Neon/production DB reads or writes, donor/item-row exports, campaign finance financial data mutations, eligibility recomputations, election model changes, migrations, deployments or scheduler work. This is review-only [PR #1287](https://github.com/killjoy00/votepredict/pull/1287); keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) open for the distinct remaining source/monetary/legal tasks.
