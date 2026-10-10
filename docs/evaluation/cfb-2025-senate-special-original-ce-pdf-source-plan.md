# #864 — bounded 2025 Senate special-election C/E original PDF source audit

## Why this batch exists

The original October 10, 2026 source capture, permanently pinned in
[the 85-version reference ledger](source-proof/cfb-2025-dated-senate-85-reference-versions.psv)
by PR #934, found 12 original-version (amendment number zero) pre-primary
and pre-general report references. Those viewer **references** are not proof
that all 12 original PDF bodies exist, that a report was legally required, or
that its financial content was publicly available during a past prediction.

This task fetches exactly those 12 public CFB PDF references and three
independently published 2025 special-election disclosure calendars. The
capture is a PR-only GitHub Actions job, is not scheduled, and uses no
production secrets or database connectivity.

| Senate district | Exact original-version registrations and periods | C originals | E originals | Total |
|---|---|---:|---:|---:|
| 6 | 19205 C/E; 19207 C; 19211 C/E | 3 | 2 | 5 |
| 29 | 19229 C/E; 19234 C/E | 2 | 2 | 4 |
| 47 | 19233 C/E; 19235 C | 2 | 1 | 3 |
| **Total** | **7 source-dated Senate registrations** | **7** | **5** | **12** |

The district mapping is drawn from the independent official 268-district-page
2026-segment source acquisition, not from candidate names or implied filing
dates. The original district roster HTML SHA-256 values were:

- District 6: 828ba9376709c12bf530ce76eb552804a623772e95160a3ae51ce0648d508f8b
- District 29: f1ab8c55e92a7956ee0f852fa6e2c875bce8743128f04693f94e67f83ee78c87
- District 47: bf0d50755c1fba7e8bc0ba87e8c21e0262c852dda4fe6ada507f47c3d67e2bf0

## Independent special-election disclosure calendars

| District | C pre-primary due | C period end | E pre-general due | E period end | Original official calendar |
|---|---|---|---|---|---|
| 6 | 2025-04-08 | 2025-04-01 | 2025-04-22 | 2025-04-15 | https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2025/Senate_6_special.pdf |
| 29 | 2025-08-19 | 2025-08-12 | 2025-10-28 | 2025-10-21 | https://cfb.mn.gov/pdf/calendars/2025_special_election_29.pdf |
| 47 | 2025-08-19 | 2025-08-12 | 2025-10-28 | 2025-10-21 | https://cfb.mn.gov/pdf/calendars/2025_special_election_47.pdf |

The original CFB PDFs explicitly label the corresponding report due dates
and coverage periods. The capture verifies each downloaded calendar's PDF
magic, SHA-256, byte length, official URL, Senate district, report labels,
year and expected date markers. Those are official calendaring controls,
not independently verified historical web-publication timestamps.

The known District 6 May 14 versus May 20 special-cycle discrepancy concerns
the later cycle-final-report scope. This C/E pilot does NOT resolve it or
silently apply one of the two dates to final reports.

## What is authenticated, and what is not

Each exact report ID originates from the original 41-registration pinned
ledger, whose canonical SHA-256 is
d34bb475cccd94481fd2f2215bf47e3c9695ad328e06bed2475967add067f0d0.
The one-time source script independently rechecks the current candidate
viewer reference, then fetches the PDF. It requires PDF magic, an official
HTTPS PDF host, a bounded byte length, binary SHA-256, and a parseable first-page
report header. A verified report must independently show the correct principal
campaign committee category, exact registration number, exact Senate district,
covered period end and actual Board-received date.

For each report, the permanent candidate data fields may be only metadata:
exact version ID, report PDF SHA-256, size, retrieval timestamp, the official
Board-received date, verified reporting period, calendar SHA-256, official
deadline, and a conservative not-before bound. Complete report/PDF text and
bytes, donor or treasurer identity, contributor details, and amounts must
NEVER be committed or logged.

An amendment-zero viewer ID does not independently prove the original report's
amendment checkbox. A later retrieval date does not establish an earlier
public disclosure date. The legal/filing bound is not a verified
historical-public-by date. Same-day replay eligibility remains excluded.
An original-version reference need not be a *legally obligated* report for
a candidate without a contested primary or on the relevant final ballot.

The source acquisition is strict: unexpected registration cohort, missing
source reference, invalid official report header, wrong district, wrong
report-period end, unavailable calendar or missing PDF all remain explicit
fail-closed results, never counted as positive proof.

## Follow-through after source acquisition

Read the GitHub Actions evidence artifact; permanently pin only authentic
metadata, PDF/calendaring identities and explicitly unresolved cases in a
subsequent source checkpoint. Investigate failures without substituting a
different report version. Obtain independent evidence that each historically
relevant filing was public by a cutoff, then separately establish the full
2021–2025 legally registered filer-year/required-report denominator and
source-to-database reconciliation before closing issue #864.

**Production finance rows, Neon and Vercel, live predictions, schedulers,
retraining, 2027 program behavior and issue #864 closure are out of scope.**
