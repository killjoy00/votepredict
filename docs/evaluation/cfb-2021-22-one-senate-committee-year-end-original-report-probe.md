# Issue #864 — 2021–2022 Senate finance: actual report PDF / due-date acquisition (bounded public pilot)

**Purpose:** test an independent historical reporting-year source outside the already verified 2025 Senate District 6 pilot, without inferring official statewide filing completeness or past publication from a report fetched in 2026.

## Exact bounded target

One independently documented Minnesota Senate committee: **Erin Murphy for Senate**, public CFB registration **18443**, Senate District **64**, elections **2021 and 2022**, retrieved through the regulator's historical **2022 two-year candidate viewer segment**. Source: [CFB candidate viewer](https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/18443/2022/). The historical 2022 election-segment viewer can contain 2021 and 2022 original reports; the code *strictly* accepts only **original** candidate year-end reports for 2021 and 2022, not House/PAC/IE, special-election, amendments, or later years.

This independent target is publicly tied to Senator Murphy's campaign via the [CFB's official 2022 disclosure material](https://cfb.mn.gov/pdf/bdactions/1630_Complaint_2.pdf), which lists Erin Murphy, Senate 64, registration 18443. It is a bounded source acquisition experiment—not a newly verified full set of Senate candidate committees for those years.

## Actual original filing information required for each report

1. Obtain exact public official CFB candidate viewer reference listing for 2021–2022, hash the **raw API response**, and filter to the two annual original report identities.
2. For each exact source reference, acquire the original official report PDF in process memory, hash the **raw PDF bytes**, extract the report header and verify **registration 18443**, name **Murphy, Erin**, Senate District **64**, reporting period end in the correct reporting year, and the exact **Received by the Board** and **Report Due Date** fields. Do not infer a due date from “2021 year-end” or use a current calendar from a different year.
3. Compute the conservative candidate-document legal/filing floor using the already-tested v7 helper: later of **day after actual due** and **day after receipt**. A 2021 year-end report could have been legally due in January 2022; early filing alone does not move that legal floor.
4. Output a metadata-only source artifact per year containing raw source PDF SHA-256, original file byte count, year, filer registration, actual receipt and due date, conservative floor, validation status, and the raw viewer API response SHA. No donor/recipient names, home addresses, raw PDF bodies, original report text, evidence database rows, or transaction amounts are retained.
5. Crucially keep **historical public-by null**, **exact transaction row containment false**, **historically eligible false**. An official report presently downloadable does not independently prove that **the same source was public before a particular 2021 or 2022 vote**. An official printed due date independently verified in a report also is not a substitute for a separate original CFB calendar, which is currently missing from the archived index for those years.

## Run the one-time source pilot

The [GitHub source probe workflow](../../.github/workflows/cfb-senate-2021-22-year-end-source-pilot.yml) runs **once** when added to main, without a schedule, secrets, DB connection or model deploy:

    node --import tsx scripts/capture-cfb-senate-2021-22-year-end-pdf-proofs.ts --output /private/cfb-senate-2021-22-year-end-one-filer.json

The download is restricted to **one official candidate viewer** and **at most two original report PDF documents**. Missing report references are marked **source_reference_not_listed**, not “no report required” and not “no contributions.” PDF fetch, malformed provenance, ambiguous committee identity and missing statutory due-date field all fail closed. A passing GitHub Actions job is not proof both dates were verified; inspect per-year statuses and report actual/source failure counts.

**Denominators:** Full historical Senate filer universe unknown; registered-but-unfiled, terminated, waivers, candidate committee special election reports, amendments, PAC/party/IE and office-chamber differences remain unsolved. Nothing in this PR backfills or changes historical prediction evidence or production. Continue #864 until official reports, identities, disclosure dates, and source-to-row coverage are reconciled for all 2021–2025 Senate candidates.
