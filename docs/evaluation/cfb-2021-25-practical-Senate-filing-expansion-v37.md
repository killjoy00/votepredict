# Minnesota Senate 2021–2025 official CFB filing expansion — V33–V37

**Research issue:** #864 · **PR:** [#1287](https://github.com/killjoy00/votepredict/pull/1287) · Original-source review-only. This continues the prior 445-version source proof, **not** an independent claim about the entire statutory reporting universe or historical public-by. No outreach, production database writes/reads, migration, model, forecast inputs, or deployment.

## What actually improved

| Working evidence measure | Previous V32 | Current collected V36 | Difference |
|---|---:|---:|---:|
| Official CFB viewer indexed candidate filing-version references | 445 | **721** | +276 |
| Original report version identities | 274 | **440** | +166 |
| Amended report version identities | 171 | **281** | +110 |
| Indexed report references with full downloaded source PDF | 444 | **480** | +36 |
| Independently distinct whole PDF file SHA256 bodies | 440 | **476** | +36 |
| Indexed report references whose PDF remains unrequested | 0 in V32 selected subset | **240** in expanded subset | New known source backlog |
| Official indexed report whose PDF retrieval previously failed | 1 | **1** | Kept in catalog, separate retry underway |
| Senators in actual 2021–25 Senate service cohort with ≥1 indexed filing | 95/95 | **95/95** | Unchanged |

The [original 396 historical government CFB candidate viewer snapshots](source-proof/cfb-2021-24-senate-396-original-viewer-source-observations.psv) were already part of the repository but were **underused**. Reconciliation recovered exactly **276 additional unique official report version IDs** in [this source-ledger](source-proof/cfb-2021-24-95-serving-senators-276-more-official-indexed-period-references-v33.psv) without duplicating the original 445 files. These are 18 in 2021, 139 in 2022, 56 in 2023 and 63 in 2024; 48 original or amended pre-primary (C), 52 pre-general (E), 176 year-end (YE). The archived source snapshots include 14 legitimate zero-report indexed-viewer responses and omit the final newline; neither should trigger a false candidate nonfiler finding or invalid source-record rejection.

The **721 reference panel** includes by report year: **2021 121; 2022 346; 2023 110; 2024 123; 2025 21**. It covers the *selected existing official government viewer evidence*, not every report legally owed by 95 senators over five years; most 2025-serving senator committees' 2025 report viewer pages have not yet been fully acquired.

### Additional genuine original PDF bodies — V35/V36

[Successful original government PDF acquisition run #38644113636](https://github.com/killjoy00/votepredict/actions/runs/38644113636) recovered **36 of 36** selected original PDF source bodies by direct GET from `https://cfb.mn.gov/rptViewer/Main.php`. This selection contained **24 2022 pre-primary/pre-general originals** for 12 candidate principal committees serving in 2025 and **12 2023 year-end originals** for 12 other candidates who served in 2025. All 36 returned the `%PDF-` signature, official HTTPS government viewer path, valid bounded file sizes, and **36 distinct full-source SHA256 bodies**. None duplicates the 440 previously obtained government whole-PDF hashes.

We intentionally did **not** require extracted first-page text, OCR, readable name/period labels, or perfect receipt chronology to recognize each exact government indexed original as a retrieved report. The [36-per-PDF permanent immutable metadata proof](source-proof/cfb-2022-24-36-serving-priority-original-PDF-binaries-v36.psv) retains exact version ID, official PDF URL, government archived index response SHA, **whole-body PDF SHA/bytes**, method and source acquisition timestamp, without raw source PDFs, transaction rows or private contributor data. The [source checkpoint](source-proof/cfb-2022-24-36-source-original-PDF-byte-SHA-checkpoint-v36.json) pins the success run/job.

Those 36 files were reconciled back into the [721-version indexed/480-downloaded inventory](source-proof/cfb-2021-25-95-senators-721-indexed-480-PDF-bodies-v36.psv) and [95-senator profile-ready source data](../../data/cfb-senate-official-filings-2021-25-v36.json). A downloaded but unparsed PDF is labeled **“PDF downloaded; contents not yet reviewed,”** not deleted, not called a filed-content verification, and not marked available before a historical vote. Remaining indexed-only files are labeled **“Listed by CFB; PDF not yet checked.”**

### Cleanup, reliability and presentation

- The [offline 721 version audit](../../scripts/audit-cfb-864-721-official-senate-filing-refs-v33.mjs) explicitly preserves *all* 445 old reference IDs and reconstructs the 276 from the exact original archived government viewer SHA bodies, preventing double counting. The [36-PDF byte integrity audit](../../scripts/audit-cfb-864-36-new-whole-pdfs-721-inventory-v36.mjs) replays 36 PDFs into the full 721 set, rather than pretending indexed-only documents have downloaded bytes. Each has adversarial tests and review-only CI workflows.
- All historical filing versions for a senator are accessible from their legislator profile using an expandable history (the prior UI surfaced only the most recent eight). Every version links to its exact CFB viewer report URL.
- The earlier **14 downloaded scanning/parsing holds, one downloaded file with inconsistent period/receipt chronology, one previously failed PDF download and four same-binary indexed aliases** remain visible as source evidence; detailed unknown fields are not invented. Standard official candidate-versus-legislative names (William/Bill; Greg/Gregory; Jeffrey/Jeff; James/Jim; Matthew/Matt) remain explicitly mapped.
- The prior [three verified original → latest-amended 2022 report-stated receipts comparisons](source-proof/cfb-2022-three-senate-original-to-latest-amendment-receipts-deltas-v31.psv) remain limited to source PDF summary arithmetic. **Do not sum original and amended financial figures** or impute donors, loans, in-kind details, candidate positions or lobbying activity from an indexed document alone.
- The exact government source SHA and source URL are meaningful identity proof. A downloaded October 2026 PDF does **not** certify that that version was publicly accessible on any particular 2021–25 vote date, and the statutory release-not-before floor is not a first-public observation.

## Important 2026 government-source redaction and PDF access limitation

The [enacted 2026 Minnesota session law, Chapter 101, Section 30](https://www.revisor.mn.gov/laws/2026/0/Session+Law/Chapter/101/) (signed May 18, 2026) required the Campaign Finance Board to **remove previously publicly posted filing documents, redact or omit private/nonpublic street addresses, and republish** them in phases. Candidate report copies filed **on or after January 1, 2022** are prioritized and subject to a six-month republication target from the law's effective date. Reports and statements **filed before January 1, 2022 have a much later statutory republication deadline of January 1, 2028**. This is a separate source availability/reposting deadline, **not** a deadline for when an original campaign finance report was filed or first public.

**Consequences for this research:** A genuine CFB viewer-listed 2021 report may have no presently retrievable PDF during the government's authorized redaction/republication process; do not call Jerry Newton a historical nonfiler or delete the indexed version. A **2026-retrieved redacted PDF's whole-body SHA256 may necessarily differ** from an unredacted version that was accessible years earlier; present source-body authenticity must never be mislabeled a bitwise certified copy of the historically public 2021–25 version. We do not search for or retain suppressed street addresses or raw contributor data, and we honor the Board's current redacted government versions.

## More recoverable public evidence

1. **2025 annual/other report refs:** the 721 current version panel has **21 selected 2025 viewer references**, from only **four of the 70 people who actually served in 2025**. The [read-only original 2026-segment CFB candidate API inventory](../../scripts/acquire-cfb-864-2025-all-serving-senator-viewer-refs-v34.mjs) targets all 70 verified 2025 Senate-serving principal registrations to identify 2025 reports and amended versions. **The fresh lookup is a separate running/queued acquisition**; do not count unverified 2025 viewer IDs until the source job outputs and the results are reconciled.
2. **Remaining 240 indexed-only 2021–24 reports:** prioritize actual 2025-serving senators' original report years and original pre-election C/E filings, using the successful raw-public-PDF fetch approach, then add important amended versions. Preserve all IDs even when PDF retrieval is temporarily unavailable. Record PDF SHA only for source bodies actually returned.
3. **Jerry Newton 2021 YE original:** its CFB original government viewer version was indexed but previously unable to deliver a PDF to the text parser; a [separate targeted raw GET/POST retry](../../scripts/retry-cfb-864-jerry-newton-2021-original-raw-PDF-v37.mjs) no longer requires PDF text extraction. Until it actually succeeds, it remains an indexed file with an unresolved PDF download.
4. **Receipts/amount completeness:** extract report-level summary amounts only for readable/certifiable cells and keep amendment financial versions separate. Where a source PDF scan requires visual review, preserve the full PDF identity without claiming individual source rows, donor amounts or historical original-first-release.
5. **Statutory owed reports:** legally required original filing denominator, active committee/termination and exemptions history are *not* computable from these viewer references alone. No compliance/nonfiler percentages until independently supported.

**Status:** The V35 public government source acquisition job has independently finished with 36 successes; the combined offline V33/V36 and full application CI jobs are separate and must pass on the final PR head before merging. Nothing has been merged or deployed in this research. Parent issue #864 remains OPEN.
