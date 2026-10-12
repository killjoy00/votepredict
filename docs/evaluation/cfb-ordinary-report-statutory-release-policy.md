# Minnesota CFB ordinary-report statutory release gate (issue #864)

**Scope:** historical Minnesota Senate finance evidence from 2021–2025. This is an offline correctness rule, not a 2027 program, serving-model change, production migration, replay rerun, or blanket completeness certificate. The shared helpers apply to all years because the legal-release defect is not limited to Senate rows.

## Authority and the two distinct clocks

Minnesota Statutes §10A.20, subdivision 1b, says that an ordinary report filed under that section **remains nonpublic until 8:00 a.m. on the day following the day the report was due**. The deadline is the *report due date*, not the day it was filed.

- Statutory source: https://www.revisor.mn.gov/statutes/2024/cite/10A.20
- Each report must retain its exact identity/type, filing date, due date, issuing regulator, source URL, and row-containment proof. A dated transaction, report-period end, report title alone, or an electronically received date alone is **not** due-date proof.
- Legal release is the calendar day after a **proven due date**, at **08:00 America/Chicago**. The conservative filing-availability bound is no earlier than the calendar day after the **proven filing date**, including a late filing.
- The earliest legally possible date is `max(due + 1 calendar day, filed + 1 calendar day)`. **It is not a historical as-of eligibility date by itself.** Even when a report was legally releasable, an exact PDF or amendment version requires independent historical publication proof. Only after such proof may date-only replay use the material on a later day (same-day remains excluded).
- An independently established **official public disclosure date** is a different proof kind and must be traceable to the actual row/report. Do not reclassify receipt dates or PDF fetch times as directly verified publication.
- Large-contribution notices and lobbying activity have separate disclosure rules and must not inherit the ordinary §10A.20 rule automatically.

Examples:
| Case | Filed | Due | Earliest legal not-before day (NOT proven public-by) | Statutory release |
| --- | --- | --- | --- | --- |
| Early 2024 Year-End filing | 2025-01-28 | 2025-01-31 | 2025-02-01 | 2025-02-01 08:00 America/Chicago |
| On-time 2024 Pre-Primary | 2024-07-29 | 2024-07-29 | 2024-07-30 | 2024-07-30 08:00 America/Chicago |
| Late 2024 Pre-Primary | 2024-08-02 | 2024-07-29 | 2024-08-03 | 2024-07-30 08:00 America/Chicago, but not yet filed |

## Repository implementation boundary

`CFB_REPORT_AVAILABILITY_VERSION=mn-cfb-report-availability-v8` distinguishes a report's legal release floor from an independently documented actual public-by date. The Board materials parser independently extracts explicit **Due** and **Filed** table fields. Official report-PDF parsing accepts an explicit **Due Date/Report Due** label and fails closed without it. That parser's legacy `window.availableOn` remains a legal **not-before** value with `proofKind=cfb_report_filing`; it does **not** establish historical publication. The transaction-availability selector now **always excludes `cfb_report_filing`** windows, even when they are on/after the legal floor and even if today’s PDF contains the exact transaction. A separately source-dated `cfb_public_disclosure` can qualify subject to report coverage, source identity and the statutory bound when filing/due fields exist. A large-contribution notice still requires its own actual filing and publication dates. An independently dated label alone does not certify exact historical PDF SHA or row containment.

The Board meeting-materials filing-table backfill now writes `statutoryNotBeforeOn`, `historicalExactVersionPublicByOn=null`, `retrospectiveAvailabilityProof=false`, and `legalFloorOnly=true` instead of falsely labelling this date `provenAvailableOn`. These retrospective filing tables may authenticate a due/receipt fact, but not an independent PDF publication capture. The CFB bulk independent-expenditure row parser still preserves `dueOn` when the source carries a due-date field. The independent-expenditure backfill's **filing + due only** branch no longer creates any eligibility mapping; it retains those fields for unpromoted evidence context. The underlying promotion SQL also accepts only separately labelled public-disclosure candidates. The candidate-finance and independent-expenditure report-PDF matching path now fails closed rather than relabelling a current PDF's legal floor as historic public-by. **No backfill or repair writer was executed.** The offline evaluation bulk reader likewise excludes statutory-floor-only rows.

Some existing historical PDF reports have a verified `Received by the Board` date but no explicit due date in the extracted text. They now remain **unresolved** rather than receiving a guessed date. Official report calendars or index data may later supply separately proven due dates through a reviewed, provenance-preserving integration.

## Previously materialized eligibility requires revalidation

**Important: previously materialized v6 and v7 rows are NOT repaired by this code-only change.** Historical candidate-finance and independent-expenditure items may already have `published_at`, `availableOn`, `asOfEligible=true`, or `filingDateDerivedAvailability=true` based on statutory release calculations or earlier filing+one. Even an unchanged v7 legal-floor date is not proof the exact version was then public. Treat these earlier eligibility claims as **revalidation debt**, without automatically rewriting records or claiming actual historical publication.

Safe follow-up (not authorized as part of this PR):

1. Read-only inventory by source family and year 2021–2025: candidate contributions, candidate expenditures, independent expenditures, PAC/political funds, party units, and notices separately. Do not combine these into “all contributions.”
2. For each row/report, preserve row identity, filer registration, report category, covered dates, due date with official authority, filing date with URL/content hash, **legal not-before** separately from **independently proven historical publication** and original-version row containment, and historical model cutoff. Count missing reports and missing source-to-row containment explicitly.
3. Compare the official CFB report inventory (the true denominator) against collected reports and persisted distinct row identities, including unresolved mappings; report unverified or ineligible rows rather than treating them as zero/neutral.
4. After separate database authorization, design an **idempotent** repair that corrects or withdraws previously eligible dates without duplicating row identities. Independently verify migration/ingestion keys, historical timestamps and frozen artifact boundaries before any write or retrospective replay.

No Neon/Vercel production writes, no migration, no scheduled backfill reactivation, no database correction, no frozen snapshot modification, and no model fitting occurred in this PR. Issue #864 remains open pending full official source-to-database reconciliation across all four workstreams.
