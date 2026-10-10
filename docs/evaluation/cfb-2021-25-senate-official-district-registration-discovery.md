# #864 — CFB statewide Senate candidate-registration discovery (not the reporting denominator)

**Purpose:** discover the original CFB **registration-number keys** associated with Minnesota Senate district candidate selection controls, independently of persisted contribution/expenditure records. This acquisition is read-only, source-observed and non-serving. A candidate label shown in a viewer is **not** proof the committee was active in a particular year or owed a particular report.

## Actual official-source reconnaissance, October 10, 2026

The metadata-only [one-time nine-page source probe](https://github.com/killjoy00/votepredict/actions/runs/38080857827) and [2020 carry-in expansion](https://github.com/killjoy00/votepredict/actions/runs/38080968120) acquired **12/12 original pages (HTTP 200)** from the official [Senate district viewer](https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/districts-constitutional-offices/Senate/35/2026), covering districts 6, 35, 64 and segment end years 2020, 2022, 2024, 2026. Every page had a response-body SHA-256. No candidate report PDFs or donor/officer contact details were captured by these probes.

The original page HTML encodes Senate candidate names in checkbox labels and their **CFB numeric registration IDs in those checkbox values**. It does **not** expose the candidate profile hyperlinks in the initially assumed form. Independently confirmed control cases:
- **CFB 18443**, Erin Murphy Senate District 64, appears on the 2022 and 2020 segment pages, matching the independently original-PDF verified 2021/2022 report ledger.
- **CFB 19205**, Keri Heintzeman Senate District 6, appears on the 2026 segment page, matching the original-PDF verified 2025 report ledger.
- **Robert Bushard** appears under registration **18937** in the 2022 Senate 64 segment but **19531** in the 2026 Senate 64 segment. Same apparent candidate name is **not** a registration identity; these keys must not be silently collapsed.
- Senate Districts 35 and 64, 2024 segment: the sampled source HTML had **no candidate checkbox labels visible**. This does not prove there were no registered Senate committees or reports due in 2023/2024.

The 2020 segment is **predecessor discovery context** for potentially continuing committees in 2021. There is **no extension of the finance evidence/reporting study into 2020 or 2026**.

## One bounded statewide official-source run

The new source collector visits exactly **67 districts × 4 election segments = 268** official CFB HTML pages, with at most two concurrent network requests and a small spacing between requests. It does not fetch report PDFs or donations, access any live database, or run a scheduler or predictive model.

It retains metadata only: official source URL, original HTML SHA-256 and fetch timestamp, source validation outcome, district and election segment, candidate display labels and CFB registration numbers. It does **not** retain full HTML, home addresses, email addresses, phone numbers, donor identities or transaction amounts.

The one-time [workflow](../../.github/workflows/cfb-senate-district-inventory-once.yml) is triggered by **the workflow file's initial merge into main**. It is neither scheduled nor manually callable. The official-source snapshot is retained as a downloadable GitHub Actions artifact for 30 days. A clean job is not itself a completeness certificate: inspect the actual 268 page statuses, distinct registration IDs, collisions and capture errors. Any missing/invalid source pages cause the source collector to exit nonzero; its partial metadata artifact is retained for explicit review, not counted as zero.

### Reproduce the acquisition (read-only source requests)

    node --import tsx scripts/capture-cfb-senate-district-registration-inventory.ts --output artifacts/cfb-senate-district-registrations.json

### Deterministic unit tests (offline)

    node --import tsx --test tests/cfb-senate-district-registration-inventory.test.ts

The report distinguishes:
1. Number of **source pages** parsed, failed or source-empty for each segment.
2. Number of **distinct CFB registration numbers observed** on those pages (not candidates matched by name, not 2021–2025 active committees).
3. Same-name/different-registration and same-registration/different-name collisions requiring identity review.
4. Independently verified CFB 18443 and 19205 control cases.
5. Explicitly **null** historical statewide registered filer count, filer-years, statutory required reports, actual filings, exemptions and nonfilers.

## Further gates before the actual finance denominator

1. Independently verify registration dates, historical Senate office/district assignment, all terminations, reactivations or new registrations, and identities absent from the public candidate selection pages, including committees with no $200+ itemized transaction.
2. Join each resulting **registered filer-year** to the applicable 2021–2025 ordinary and special-election reporting calendar. Keep actual election/ballot status, waived electronic filing, termination reports, legally exempt or canceled reports, and genuine nonfilers separate.
3. Independently acquire actual filed-report **versions**, including original versus amendment and late/termination versions, then establish each original PDF's actual filing date, due date, independent historical public-by proof and exact row containment.
4. Reconcile only after an explicitly separately authorized SELECT-only existing DB export; no production evidence repair or forecast retraining/serving is authorized here.

**Do not close #864** until the true official filer and report denominator and the source-to-DB reconciliation are established. A complete scan of 268 *presently available public pages* is not a comprehensive historical registration or reports certificate.
