# #864 — historical Senate candidate CFB filing counts: bounded discovery protocol

**Purpose:** move from report proofs for seven 2025 Senate special-election committees to a much wider **2021–2024 historical candidate viewer reference count**, while separately recording what the regulator actually published about statewide year-end filing obligations. These are two distinct metrics and MUST NOT be conflated.

## A. Original official 494-registration viewer sample, derived without guessing dates

The previously source-hashed [268-page Senate district roster inventory](source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json) observed 494 distinct candidate registration IDs across four even-year election viewer segments (2020, 2022, 2024, 2026).

Exactly **270** registrations appeared in the original official 2022 segment; exactly **126** appeared in the original 2024 segment. Their union is **275** registrations. Their **396 registration×segment pairs**, each queried once, expose candidate reports tab metadata for 2021/2022 and 2023/2024, respectively. Each report/version key is classified by report year, period, special-election flag, registration number, and amendment index. An amendment of an original source report remains a separate *version*, not a second original filing obligation.

The source selection excludes **84 registrations visible only in the 2020 comparison segment**, **134 visible only in 2026** (including the 41 separate 2025-dated registrations already captured), and **one registration visible in 2020 and 2026 but neither middle segment**. Those IDs are **unprobed in this 2021–24 count**; not treated as unregistered, legally inactive, exempt, or nonfiling in the intervening years. Registrations never visible in the 268 district pages are not enumerated. Distinct registrations and election segments are *not* historic active committee-year counts.

The PR-only GitHub Actions job runs two capped official CFB readers and retains only original CFB reports-tab API body SHA-256, exact report viewer version identifiers and per-year counts. It **does not** fetch a PDF, donor data, transaction rows, treasurer/contact identity, or original raw API HTML. Every source failure is explicit, so zero discovered references cannot be used as proof of zero filing. No 2021–24 viewer reference becomes an original authenticated PDF, historical report published-by date, or report that was legally due.

At each report year the output independently states the number of source-scoped registrations, valid viewer source responses, registrations with references, registrations with no *observed* references, original-version references, amended-version references, distinct viewed report groups, and source failures. The legally required/actually filed original Senate report totals and statewide historic committee denominator remain **null**.

## B. First independently published year-end filing baselines are broader than Senate

The Board's original February reports provide useful official reported **candidate+party unit+committee+fund** obligations and timely filings. These totals are across **all state offices and categories**, NOT Senate candidate committees and NOT the candidate-specific annual subtotal. The values and original URLs are saved in the [all-entity Board memo checkpoint](source-proof/cfb-2021-25-board-yearend-all-entity-count-context.json).

| CFB reporting year | Year-end report due | All-entity CFB obligation evidence | All-entity timely filings | What is still not known |
|---|---|---|---|---|
| 2021 | 2022-01-31 | Notices sent to **more than 1,350** candidate, party and committee/fund filers | **unknown** | Notices not an exact due denominator |
| 2022 | 2023-01-31 | **1,515 reports due** | **1,367 by deadline** | Candidate/Senate split; published **98%** conflicts with the reported counts |
| 2023 | 2024-01-31 | **1,299 reports expected** | **unknown** | Estimate before deadline, not certified final due count |
| 2024 | 2025-01-31 | **1,320 reports due** | **1,212 by deadline** | Candidate/Senate split and eventual actual filings |
| 2025 | 2026-02-02 | **unknown** | **unknown** | February 2026 meeting narrative says **93% received**, without counts or proof which came by deadline |

Source URLs (independent Board publications):

- 2021 reporting year: https://cfb.mn.gov/pdf/bdinfo/agendas/2022_02_02_materials.pdf (January 26, 2022 director memo).
- 2022 reporting year: https://register.cfb.mn.gov/pdf/bdinfo/agendas/2023_02_08_materials.pdf (February 1, 2023 director memo).
- 2023 reporting year: https://cfb.mn.gov/pdf/bdinfo/agendas/2024_02_07_materials.pdf (January 31, 2024 director memo).
- 2024 reporting year: https://cfb.mn.gov/pdf/bdinfo/agendas/2025_02_13_materials.pdf (February 5, 2025 director memo).
- 2025 year-end due date: https://cfb.mn.gov/pdf/bdinfo/minutes/2025_12_03_regular_session.pdf (December 3, 2025 Board minutes).
- 2025 year-end February 2026 Board summary: https://cfb.mn.gov/pdf/bdinfo/agendas/2026_03_12_materials.pdf (February 4, 2026 draft minutes attached to March 12 meeting).

**2022 source inconsistency:** The Board's February 1, 2023 memo says **1,515** due, **1,367** timely and **98%** timely. 1,367/1,515 is **90.2%**, not 98%. Preserve the *two original reported counts*, flag the bad percentage, and do not invent which figure staff meant to publish. Also do not turn the missing **2024** timely count (1,320 minus 1,212 = 108) into the **64** reports still outstanding on February 5, 2025: those are observations at different dates, allowing late reports filed before the memo.

## C. To establish legally owed reports, not merely source references

For every 2021–2025 Senate candidate committee-year we still need the original **registration and termination dates**, date of any re-registration and election/ballot applicability (non-running committee vs pre-primary, candidates continuing to general, regular vs special district), applicable **year-specific** statutory and independent calendar deadlines, original report submission/filing (plus nonfilers, termination reports and waivers), amendment lineage, and official independent historic public-by evidence. A later-retrieved report PDF with a Board-received date still cannot prove the PDF was public by the relevant historical forecast cutoff. A year-end report covering 2025 but filed in 2026 cannot inform a 2025 forecast.

The original CFB viewer counts should be extended to the **84 carry-in-only and one 2020/2026** registrations with year-by-year legally dated status, rather than assume those committees were terminated or exempt. Conversely, the 41 independent 2025 registrations previously proved have 85 2025 report-version references (60 original-version keys and 25 amendments) within a separate sample, with 12 C/E original PDF bodies now independently verified. All those counts retain their cohort labels.

**Source-only and metadata-only:** no production Neon/Vercel activity, database backfill, serving or model changes, raw financial data, schedulers, 2027 program changes or closure of issue #864.
