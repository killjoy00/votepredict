# Issue #864 — Minnesota Senate 2021–2025 CFB pinned-ledger coverage

This is an **offline source-provenance audit**, not an official statewide denominator, a historical publication certificate, or a production evidence repair. The two pinned original-document CFB ledgers already exist in this repository; the audit does not reacquire the PDFs, access the database, rerun predictions, change a scheduler, or retain transaction/donor details.

## Verified original report source sample

The independent 2021–2022 Senate District 64 original-report/calendar [ledger](./source-proof/cfb-2021-22-senate-one-filer-original-reports-and-calendars.json) contains two original year-end reports for CFB registration **18443** (Erin Murphy). The Board received the 2021 year-end report January 28, 2022, ahead of its verified January 31 statutory deadline: conservative legal/filing release floor **February 1, 2022**. The 2022 year-end report was received January 30, 2023, also before its January 31 statutory deadline: conservative floor **February 1, 2023**.

The independent 2025 Senate District 6 original-report/calendar [ledger](./source-proof/cfb-2025-senate-district6-report-pdfs.json) contains **five independently hashed original PDF versions** for registration **19205**: four original report identifiers and a separate year-end amendment. The ordinary 2025 year-end report was received January 30, 2026, due February 2, 2026, with legal/filing floor **February 3, 2026**. Its amendment was received May 24, 2026, with separate conservative floor **May 25, 2026**. Neither is available for forecasting a vote during 2025. The unresolved special-election final-period discrepancy between original CFB calendars remains flagged, not silently adjudicated.

| Reporting year | Candidate committees with verified reports in these pilots | Original report versions | Amended versions | Total verified PDF versions |
| --- | ---: | ---: | ---: | ---: |
| 2021 | 1 | 1 | 0 | 1 |
| 2022 | 1 | 1 | 0 | 1 |
| 2023 | 0 observed in these pilots | 0 observed | 0 observed | 0 observed |
| 2024 | 0 observed in these pilots | 0 observed | 0 observed | 0 observed |
| 2025 | 1 | 4 | 1 | 5 |
| **Total** | **2 distinct committees** | **6** | **1** | **7** |

Zero observations for 2023/2024 in these *selected pilot ledgers* do **not** mean zero official Senate filers, obligations or filings in those years. Nor do six observed original report identities imply exactly six legally required reports.

The new TypeScript audit validates each original report SHA-256 format, original CFB calendar provenance, report identity and viewer URL, independent legal deadline, actual received date, and conservative later-of-due-and-filed release floor. Eight tests pin **all seven exact original PDF digests** and reject inconsistent office, hash, report ID, dates, original calendar validity, false historical publication claims, and contradictory duplicates.

## Run without contacting any external service

From the repository root:

    node --import tsx scripts/audit-cfb-senate-pinned-ledgers-offline.ts
    node --import tsx --test tests/cfb-senate-pinned-ledger-coverage.test.ts

Optional metadata-only report output:

    node --import tsx scripts/audit-cfb-senate-pinned-ledgers-offline.ts --output /private/cfb-senate-pinned-coverage.json

The CLI refuses to overwrite the two pinned original provenance ledgers. Its year-by-year values are *pilot sample counts*. For every year, the following remain explicitly **null/unknown**, not zero: official statewide Senate registration denominator, required-report denominator, actually-filed reports, historically attributable nonfilers, and historical public-by report counts. No source-specific transaction row has been certified contained in these pilot PDFs, and no historical forecast eligibility is granted.

## Next work required for the actual finance denominator

1. **Independently acquire historical statewide Senate registration histories**, with registration numbers, candidate/chamber/district, validity periods and original source hash, including terminated committees and committees absent from itemized transaction exports. A current regulator list and the over-$200 bulk exports alone are not a historical roster certificate.
2. **Resolve per-registration obligations** from applicable ordinary and special-election filing calendars, dates of registration/termination, waivers/exemptions and filing category. Keep candidate principal committees separate from IE, PAC and party units; never equate an amendment with an additional statutory obligation.
3. **Reconcile actual submitted reports** including amendments, late reports, exemptions, verified nonfiling notices, source viewer gaps, and report-level PDF proofs. Explicitly distinguish unknown/absent-source from official zero.
4. **After separately authorized SELECT-only export**, reconcile each historic database finance record to exact source/report/transaction containment and independently established *historical public-by* evidence. Later PDF retrieval is not evidence of availability prior to a specific vote. Design idempotent corrections separately; do not perform live DB writes here.

Issue #864 stays **open**. This patch changes no serving, model training, frozen artifacts, production databases or 2027 work.
