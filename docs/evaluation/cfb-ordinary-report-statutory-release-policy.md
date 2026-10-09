# Minnesota CFB ordinary-report statutory release gate (issue #864)

**Scope:** historical Minnesota Senate finance evidence from 2021–2025. This is an offline correctness rule, not a 2027 program, serving-model change, production migration, replay rerun, or blanket completeness certificate. The shared helpers apply to all years because the legal-release defect is not limited to Senate rows.

## Authority and the two distinct clocks

Minnesota Statutes §10A.20, subdivision 1b, says that an ordinary report filed under that section **remains nonpublic until 8:00 a.m. on the day following the day the report was due**. The deadline is the *report due date*, not the day it was filed.

- Statutory source: https://www.revisor.mn.gov/statutes/2024/cite/10A.20
- Each report must retain its exact identity/type, filing date, due date, issuing regulator, source URL, and row-containment proof. A dated transaction, report-period end, report title alone, or an electronically received date alone is **not** due-date proof.
- Legal release is the calendar day after a **proven due date**, at **08:00 America/Chicago**. The conservative filing-availability bound is no earlier than the calendar day after the **proven filing date**, including a late filing.
- The historical date-only eligibility boundary is `max(due + 1 calendar day, filed + 1 calendar day)`. That date itself remains excluded from date-exclusive same-day as-of model cutoffs; without independent intraday sequencing a model can use the evidence only on a later day. The filing bound is deliberately conservative if the report was late; it is not an assertion of an exact actual web-publication timestamp.
- An independently established **official public disclosure date** is a different proof kind and must be traceable to the actual row/report. Do not reclassify receipt dates or PDF fetch times as directly verified publication.
- Large-contribution notices and lobbying activity have separate disclosure rules and must not inherit the ordinary §10A.20 rule automatically.

Examples:
| Case | Filed | Due | Earliest conservative available-on date | Statutory release |
| --- | --- | --- | --- | --- |
| Early 2024 Year-End filing | 2025-01-28 | 2025-01-31 | 2025-02-01 | 2025-02-01 08:00 America/Chicago |
| On-time 2024 Pre-Primary | 2024-07-29 | 2024-07-29 | 2024-07-30 | 2024-07-30 08:00 America/Chicago |
| Late 2024 Pre-Primary | 2024-08-02 | 2024-07-29 | 2024-08-03 | 2024-07-30 08:00 America/Chicago, but not yet filed |

## Repository implementation boundary

`CFB_REPORT_AVAILABILITY_VERSION=mn-cfb-report-availability-v7` requires both `filedOn` and `dueOn` to calculate ordinary-report eligibility. The Board materials parser independently extracts explicit **Due** and **Filed** table fields. Official report-PDF parsing accepts an explicit **Due Date/Report Due** label and must fail closed when no such due field is recovered. The report-window selector refuses filing-derived windows without both dates, or dates earlier than the conservative bound. An official source's own disclosure-date column remains a distinct, directly dated disclosure source; do not infer its value from filing data.

The CFB bulk independent-expenditure row parser preserves a distinct `dueOn` when an official due-date field exists. The candidate and IE offline backfill code carries `reportDueOn` and identifies `dueDateAndFilingBoundApplied` in its prospective write metadata. This branch **does not execute those writers**. The evaluation-only bulk reader no longer substitutes filing+one when the due-date field is absent.

Some existing historical PDF reports have a verified `Received by the Board` date but no explicit due date in the extracted text. They now remain **unresolved** rather than receiving a guessed date. Official report calendars or index data may later supply separately proven due dates through a reviewed, provenance-preserving integration.

## Previously materialized eligibility requires revalidation

**Important: v6 rows are not repaired by deploying these code changes.** Historical candidate-finance and independent-expenditure items may already have `published_at`, `availableOn`, `asOfEligible=true`, and `filingDateDerivedAvailability=true` based on filing+one. Those values **must be considered unverified** until a source-to-row due-date and regulatory release audit proves otherwise. A later correct bound can invalidate earlier model-eligible windows, and it is **not** enough merely to promote newly proven rows.

Safe follow-up (not authorized as part of this PR):

1. Read-only inventory by source family and year 2021–2025: candidate contributions, candidate expenditures, independent expenditures, PAC/political funds, party units, and notices separately. Do not combine these into “all contributions.”
2. For each row/report, preserve row identity, filer registration, report category, covered dates, due date with official authority, filing date with URL/content hash, proof of public disclosure or legally bounded availability, and historical model cutoff. Count missing reports and missing source-to-row containment explicitly.
3. Compare the official CFB report inventory (the true denominator) against collected reports and persisted distinct row identities, including unresolved mappings; report unverified or ineligible rows rather than treating them as zero/neutral.
4. After separate database authorization, design an **idempotent** repair that corrects or withdraws previously eligible dates without duplicating row identities. Independently verify migration/ingestion keys, historical timestamps and frozen artifact boundaries before any write or retrospective replay.

No Neon/Vercel production writes, no migration, no scheduled backfill reactivation, no database correction, no frozen snapshot modification, and no model fitting occurred in this PR. Issue #864 remains open pending full official source-to-database reconciliation across all four workstreams.
