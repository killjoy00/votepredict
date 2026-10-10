# Issue #864 — 2021–2022 Senate annual reports: independently sourced disclosure calendars

**Date:** October 10, 2026. **Scope:** a small, read-only official-source proof for 2021 and 2022 original annual candidate reports from one independently identified Minnesota Senate candidate committee, CFB registration 18443 (Erin Murphy, Senate District 64). No production database writes/reads, no forecasting changes, no full donor PDFs saved, no scheduler, and no 2027 activity.

## Existing real report/source status (preceding PR #874)

The [one-time actual CFB candidate viewer/PDF run #38004371301](https://github.com/killjoy00/votepredict/actions/runs/38004371301) downloaded **two original 2021 and 2022 CFB year-end report PDFs** and hashed their original bytes with no source fetch failures. It verified the committee's name and Senate 64 identity from the PDF headers.

However, its generic source proof parser returned **0/2 fully verified filing/due headers** because the PDF bodies did not satisfy the globally strict due-date-and-filing parser. This is NOT evidence those reports were unavailable at the time, and definitely not a reason to backdate any evidence. The generic evidence parser continues to fail closed when a report lacks a printed due-date field. A report title/transaction date must never be substituted for an actual statutory due date.

The 2021/2022 calendar **archive index** only lists links for 2023 onward as of October 2026. But original CFB **older calendars do exist elsewhere** on the regulator's document server:

1. [Official 2022 candidate packet](https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2022/House_2022.pdf) (May 17, 2022), including the original **2022 Disclosure Calendar for Candidates for Senate, House and District Courts**. It specifically lists **2021 year-end report due January 31, 2022**, for January 1–December 31, 2021. This is the proper annual report deadline proof, not an inferred title-date or the following year's archive index.
2. [Official 2023 Campaign Finance Disclosure Calendar](https://cfb.mn.gov/pdf/calendars/2023_general_disclosure_calendar.pdf). It specifically lists the **2022 year-end report due January 31, 2023**, for January 1–December 31, 2022. Its ordinary 2023 reporting/calendar duties are not brought into this historical proof's row universe.

**Important:** The 2022 candidate packet is a *House mailing*, but its **embedded statutory 2022 calendar explicitly covers Senate and House candidates**. Only that calendar section is applicable to the Senate report; the rest of the House mailing is not implicitly applicable to Senate filers. If a committee was exempt from a particular deadline, terminated, or not participating, the source rule needs independent case-specific review.

## Implementation details and safety gates

- Separate pure module: src/evidence/cfb-senate-2021-22-independent-calendar-audit.ts. Exactly two manually scoped calendar/report pairs, each with official CFB PDF source URLs and original PDF byte SHA-256. Rejects wrong annual year, wrong filer, wrong office/district, nonprincipal committee, amendments, absent original PDF, missing/invalid receipt, missing/invalid calendar, and duplicate or mismatched source captures.
- New safe PDF-header extractor verifies candidate name, Senate 64, registration 18443 *near the registration label*, original reporting-period dates, and **Received by the Board** receipt date. It emits only structural booleans and date-only fields, not donors, mailing addresses, contribution amounts or report body.
- Independently verifies that the original 2022 candidate PDF contains the **2022 Senate/House/District Court calendar**, exact report year and period, and that the 2023 general calendar contains the 2022 year-end obligation. Explicitly reviewed January 31 due-date table headings are pinned to those exact documentary years. Do not re-use the dates for special-election, party unit, PAC/IE, or late-filing notice reports.
- New bounded one-time CFB Actions source collector: one candidate report viewer (HTML+API), at most **two** annual report PDFs, and **two** original calendar PDFs. Original PDF body is used only transiently for validation; the workflow artifact contains only hashes, dates, source URLs, structural metadata, and explicit source errors.
- Synthetic tests cover early/late filings, missing due field in original PDF, case-specific independent calendar, mismatched identity, bad/ambiguous source, no calendar, duplicates, and fail-closed historic publication policy.

## What must not be inferred

Even with a verified official receipt date and independently verified statutory calendar, the conservative legal floor is only the later of **the day after the due date** and **day after the filing receipt**, in America/Chicago under the already merged v7 rule. It is **not** independently proved the original PDF was publicly *available by* that historical date, and a PDF downloaded October 2026 does not establish that it was downloadable before any earlier vote.

Every report output continues to set **verifiedHistoricalPublicByOn=null**, **transactionRowContainmentVerified=false**, **historicallyEligible=false**. Independent calendar PDFs are a source for annual deadlines, not a denominator for **required reports** or **registered Senate candidate committees**. The official 2021–2025 Senate filer roster, filing/exemption universe, amendments, special elections, PACs/IE and party units remain unresolved. No values are promoted into live/historical evidence tables; no production access is performed.

## How to review

Run only the [one-time source proof action](../../.github/workflows/cfb-2021-22-independent-senate-report-calendar-probe.yml) or its standalone script:

    node --import tsx scripts/capture-cfb-2021-22-senate-independent-calendar-proofs.ts --output /private/senate-2021-22-original-annual-proof.json

Require actual per-year **original_report_receipt_and_independent_calendar_due_verified** results before recording the statutory/filing floor. A green workflow only says the command completed; it is **not** a report proof unless the corresponding year status and source hashes are independently checked. If a source is unparseable, the one-shot output records limited missing structural flags and leaves it unverified; never insert a guessed date.

Issue #864 remains OPEN until official source-to-DB and required/actual-report denominator reconciliation is completed.
