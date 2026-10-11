# Historical public availability barriers for 71 authenticated-source Minnesota CFB year-end version references

**Campaign-finance original public-source research only**, issue #864, 2026-10-11.

This source-only audit joins **71 exact official 2023–2024 CFB year-end PDF viewer version IDs** for the prior **22 independently confirmed actual 2022-serving Minnesota senators** to the original Minnesota [2023 general annual calendar](https://cfb.mn.gov/pdf/calendars/2023_general_disclosure_calendar.pdf), [2025 general annual calendar](https://cfb.mn.gov/pdf/calendars/2025_general_diclosure_calendar.pdf), [2023 §10A.20](https://www.revisor.mn.gov/statutes/2023/cite/10A.20), [2024 §10A.20](https://www.revisor.mn.gov/statutes/2024/cite/10A.20), and [§10A.243](https://www.revisor.mn.gov/statutes/2024/cite/10A.243). The original legal source body SHAs and byte counts are separately proven in the [five-primary-source law checkpoint](source-proof/cfb-2023-24-original-board-yearend-calendar-and-revisor-release-checkpoint.json) (PR #1108).

The [71 exact-version source release-barrier ledger](source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv) **does not contain actual historical public-by dates**. All 71 are explicitly unknown, and none is granted as-of forecast eligibility.

## Verified source accounting and clocks

| Source cohort | Official version IDs | Authenticated distinct PDFs | Identity holds | Official version-index aliases |
| --- | ---: | ---: | ---: | ---: |
| 2023 YE originals | 22 | 21 | 1 | 0 |
| 2023 YE amendments | 10 | 9 | 1 | 0 |
| 2024 YE originals | 22 | 22 | 0 | 0 |
| 2024 YE amendments | 17 | 16 | 0 | 1 |
| **2023–2024 total** | **71** | **68** | **2** | **1** |

The two held PDF identities are **Andrew R. Lang's 2023 original** and **Aric Putnam's 2023 amendment index 1**, kept unverified even though official source PDF binary hashes exist. Putnam's 2024 amendment index 2 refers to the **same authenticated source PDF body as index 1**, not an extra amendment. No raw financial PDF, donor names, or transaction rows appear in the new ledger. All 68 distinct authenticated PDF hashes were previously verified from primary source binaries in two independent acquisitions.

## Legal release is a NOT-BEFORE bound, not a publication timestamp

- **2023 YE** covers January 1–December 31, 2023; January 31, 2024 is the ordinary filing deadline; the statutory nonpublic restriction ends **February 1, 2024 at 8:00 a.m. America/Chicago**.
- **2024 YE** covers January 1–December 31, 2024; January 31, 2025 is the ordinary deadline; the statutory nonpublic restriction ends **February 1, 2025 at 8:00 a.m. America/Chicago**. February 1 was a Saturday; the law does not certify that particular version was made available online then.
- The paper Board receipt date is recorded separately. For a PDF authenticated as the correct target, the ledger's `earliestPossibleDateFloor` is no earlier than **both** the statutory release date **and** the paper-receipt calendar date. It is a **date-level lower bound only**; the Board receipt includes no clock time and is **not** a verified public posting.
- For either held original/amended identity, `earliestPossibleDateFloor` is intentionally **null** because the paper PDF identity is unverified; the year-level statute is still recorded separately.
- The duplicate official amended viewer index is shown with its canonical reference ID, and is never counted as another authenticated PDF.
- `historicallyActuallyPublicByOn` is null for **all 71**, `thisExactReportLegallyOwed` is null for **all 71**, and `historicalForecastEligible` is **false for all 71**.

A vote cutoff **before** the release-or-receipt floor proves the particular version could **not yet** have been public; that is a useful definitive historical exclusion. A vote on the statutory release day requires intra-day precision even before testing actual publication. Any vote after the earliest possible date is only **possibly**, not **proven**, informed by this report. The provenance of an **exact version**'s historical online display must be established independently before source-based eligibility is even considered.

## Why this is not a compliance census

[§10A.20 subd. 1](https://www.revisor.mn.gov/statutes/2024/cite/10A.20) conditions required reporting on committee registration and termination and [§10A.243](https://www.revisor.mn.gov/statutes/2024/cite/10A.243) specifies filing a final termination report with asset disposition. The 2022 actual-senator identification is not evidence that each remained in office throughout 2023 and 2024, nor is the presence of a form proof that it was **legally due** under all relevant conditions. The **statewide or cohort-specific legally owed report denominator remains unknown**, not 44, 68, 71 or zero.

## Permanent original evidence

The [machine-checkable source checkpoint](source-proof/cfb-2023-24-served-22-71-yearend-legal-release-and-publicby-checkpoint.json) pins the exact Git blob fingerprints of the complete 71-row ledger and **all four** underlying original PDF-provenance ledgers, along with their classifications, statutory clocks and unknown legal duty/public-by fields. Tests guarantee that tampering with calendar, Board receipt floor, PDF identity, official-version alias, or historical eligibility fails closed.

Next original-public-source tasks are **(1)** verify historically active/terminated committee registrations to establish legally owed denominator, **(2)** find a contemporaneous dated public Board listing or archived exact version to prove historical public-by without confusing it with Board receipt, and **(3)** source remaining actual-serving senators beyond the 22-person district-bounded panel. Nothing here reaches production databases, financial transaction rows, serving, forecasts, model training or schedulers, and no 2027 scope is included. Keep issue #864 **OPEN**.
