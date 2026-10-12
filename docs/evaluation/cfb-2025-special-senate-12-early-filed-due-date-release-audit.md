# Issue #864 — 2025 special Senate CFB early-filed reports: due-date release controls

**Status: independent offline re-audit from previously fully authenticated original
Minnesota Campaign Finance and Public Disclosure Board report PDF headers and
three separately authenticated election-calendar PDF sources.** Read-only
source metadata only, no original PDF bodies, donors, named people, transaction
rows, production database or forecasts.

The [original source checkpoint](source-proof/cfb-2025-senate-12-special-original-pdf-source-checkpoint.json)
records 12 separately SHA-256 authenticated original-version C/E report PDF
headers, 12 Board received dates, 3 exact district-specific original disclosure
calendars and 0 original-source failures (Action #38087106096). The source
[PSV ledger](source-proof/cfb-2025-senate-12-special-original-pdf-source-ledger.psv)
is independently SHA-pinned without its last newline to
`5048b6fa2220a92a6e6a61484f49a224c3fd60fc4e5900d42e6f31c9852517b9`.
**Original-version viewer key `amend=0` does not itself prove the checkmark
for an unamended original report.**

The existing
[`cfbElectronicReportAvailableOn(filedOn,dueOn)`](../../src/evidence/cfb-report-availability.ts)
enforces the 2025 Minnesota §10A.20, subdivision 1b ordinary-report rule:
**not before 08:00 America/Chicago on the day after the statutory report DUE
date**. Later filing adds a separate conservative floor. **Filing-plus-one
alone is insufficient when the original report was filed early.** The exact
calendar due date must be selected by district and report period, not by
the report-year or period-ending date.

The [new offline source auditor](../../src/evidence/cfb-2025-senate-special-12-due-vs-received-audit.ts)
reopens the exact immutable source ledger, checks its real SHA-256, checks
the original full-PDF-and-calendar source checkpoint and each row's
original source PDF SHA, verified registration/period identity, Board
received date, calendar due date, coverage end and recorded source legal
floor. It then computes a row-specific independent receipt-vs-due check,
including what a **naive filing+1 date would have been**. A strict
[static proof snapshot](source-proof/cfb-2025-senate-12-special-due-vs-received-historical-release-floor-audit.json)
contains 12 rows; [regression tests](../../tests/cfb-2025-senate-special-12-due-vs-received-audit.test.ts)
must exactly reproduce the snapshot from the original pinned sources.

| 2025 special-election district | Original version PDF headers | Received **before due** | Received **on due** |
|---|---:|---:|---:|
| Senate District 6 | 5 | 3 | 2 |
| Senate District 29 | 4 | 2 | 2 |
| Senate District 47 | 3 | 2 | 1 |
| **Total** | **12** | **7** | **5** |

Each of these **seven** early-filed reports would be wrongly backdated if
the report's public-availability bound were calculated from **Board received
plus one day** instead of report due-plus-one. For example, an original
District 29 pre-general report was received **October 22, 2025**, whereas
the original special-election calendar requires the pre-general report
on **October 28, 2025**. Filing+1 would claim an October 23 floor; the
legal release floor is **October 29, 2025 at 08:00 CDT**—six days later.

This audit **does not prove** that any exact report PDF was actually
accessible to a researcher on its statutory earliest release day.
All 12 `independentExactPDFHistoricallyPublicByOn` values remain **NULL**.
This source subset comprises 12 PDF header versions from 7 2025
registrations, *not* all 2025 filer/report obligations, not contributor
records, not independent expenditures or PAC/party entities, not a
verification of actual serving senators, and not a complete statewide
historical report or eligible-row denominator. Do not use this derivative
for historical features or forecast eligibility.

No automatic report public-by recompute, private rows, CFB cash amounts,
personal donor information, production Neon/Vercel, models, training,
scheduler, Senate floor, 2027 program or public office contact. **Keep
issue #864 OPEN** until source-to-existing-data reconciliation and real
official denominators are established. The unrelated 2022 Finance
committee written-roll parser source holds stay unresolved, not promoted.
