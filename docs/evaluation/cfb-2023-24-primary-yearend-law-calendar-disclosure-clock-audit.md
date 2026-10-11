# Historical Minnesota Senate campaign finance: 2023–2024 original reporting law and public-release threshold

**Scope:** Original public-source research for finance track of [issue #864](https://github.com/killjoy00/votepredict/issues/864), dated 2026-10-11. This document covers **only** standard principal campaign committee year-end (YE) reports for financial years 2023 and 2024. It does not assert that any of the 22 previously 2022-serving senators remained a senator in both later years, nor does it declare any particular committee legally obligated to file.

## Evidence newly recovered

Five independently retrieved **original Minnesota government documents** have been preserved in [the official source SHA/byte provenance checkpoint](source-proof/cfb-2023-24-original-board-yearend-calendar-and-revisor-release-checkpoint.json). All original 2023 and 2024 statute paragraphs and both original CFB year-end calendar PDF reporting-year and deadline statements were source-verified. No report PDF, HTML content, contributor data or financial transaction rows were committed.

| Period covered | Board's original calendar | Ordinary YE filing deadline | Statutory nonpublic period ends, local Minnesota time |
| --- | --- | --- | --- |
| January 1–December 31, **2023** | [CFB's archived **2023** general disclosure calendar](https://cfb.mn.gov/pdf/calendars/2023_general_disclosure_calendar.pdf) | January 31, **2024** | **February 1, 2024, 8:00 a.m. America/Chicago** |
| January 1–December 31, **2024** | [CFB's archived **2025** general disclosure calendar](https://cfb.mn.gov/pdf/calendars/2025_general_diclosure_calendar.pdf) | January 31, **2025** | **February 1, 2025, 8:00 a.m. America/Chicago** |

The original [2023 Minnesota Statutes §10A.20](https://www.revisor.mn.gov/statutes/2023/cite/10A.20) and [2024 §10A.20](https://www.revisor.mn.gov/statutes/2024/cite/10A.20) each independently confirm: subdivision 2(a) requires the regular January 31 annual report, subdivision 4 establishes December 31 as the annual reporting cut-off, and **subdivision 1b expressly keeps a filed report nonpublic until 8:00 a.m. the day after it was due**. Therefore even a report stamped as received *before* January 31 cannot lawfully be treated as publicly available for forecast time travel on January 31. In 2025, February 1 was a Saturday; the law's end-of-nonpublic time is not proof that the Board actually made that particular document available on that Saturday.

## Four distinct clocks — NEVER interchange them

1. **Financial activity/coverage period**: the calendar-year interval the report describes. Example: 2024 YE covers January 1–December 31, 2024. This cannot prove knowledge of an event during 2024.
2. **Board-printed receipt date**: a date the paper version says the Board received it. It may precede the filing due date. It cannot establish when the public could read it. A report PDF with a mismatched committee name/registration may not even authenticate the reported receipt as belonging to the target committee.
3. **Earliest statutory release**: an absolute *not-before* threshold, February 1 at 8:00 a.m. CT in each following year. For a late-filed amended version, the actual report cannot have been public before it was received, even though the original statutory release date has passed.
4. **Actual public-by**: an independently timestamped publication, archived original Board public version, contemporaneous public listing or other true historical public availability evidence attributable to the exact committee/report **and exact version/body**. Not established for any version in the currently verified 2023–2024 sample. Absent this, **do not permit forecast as-of inclusion**.

## Legally owed reports: conditional, not one per politician per year

The original [Minnesota Statutes §10A.20, subdivision 1](https://www.revisor.mn.gov/statutes/2024/cite/10A.20) requires a committee to continue filing as long as it has a qualifying reporting duty and remains registered until termination; the original [§10A.243](https://www.revisor.mn.gov/statutes/2024/cite/10A.243) establishes a special final termination report and disposal of assets exceeding $100. **A senator's 2022 service status and a year-end PDF observed on the modern website are not a historic registration/termination audit**. The number of *legally required* 2023 and 2024 reports is **unknown**, not 44, not 71 and not 0. Documenting that a committee submitted a particular form is a different statement from proving it was required to submit the form under every applicable exception.

This legal source research does not establish report-specific actual publication timestamps, individual committee legal obligations, exact 2023/2024 Senate service, or the filing histories outside the bounded 22-committee/71-version source sample. These remain source-only research tasks; never silently convert the legal lower bound into a public-by timestamp.

## Source integrity and application limitations

Primary source SHA-256 and actual input PDF/HTML bytes are permanently pinned in the [metadata checkpoint](source-proof/cfb-2023-24-original-board-yearend-calendar-and-revisor-release-checkpoint.json). The first exploratory source workflow run exposed a harmless-but-invalid **byte-size metadata extraction bug**: the PDF parser transferred its input bytes before the caller inspected their length, yielding reported size 0 for calendar PDFs, though pre-parse SHA was correct. The code was corrected to capture byte lengths *before* PDF parsing and to hard-fail on zero-byte source metadata. The corrected source workflow independently verified both PDFs and all three original Revisor legal texts. The invalid initial 0-byte metadata is **not** accepted as byte provenance.

All source work is original public government source reading; no live production DB access, model training, prediction serving, scheduler, transaction ingestion, new candidate contact or 2027 scope. Issue #864 remains OPEN.
