# Issue #864: 2025 Minnesota Senate District 6 — report PDFs, filed dates, and distinct statutory due dates

This is an **actual-source-acquisition pilot** following merged reference inventory [PR #869](https://github.com/killjoy00/votepredict/pull/869). It does not certify the 2021–2025 CFB denominator or alter the historical feature corpus. It acquires, in memory, a maximum of **five 2025 CFB Senate District 6 candidate-report PDF bodies** and exactly two public CFB disclosure calendar PDFs, derives and saves **only source hashes and report-header timing metadata** to one private-in-GitHub artifact, and then discards PDF source text.

## Official sources and legal controls

Official [Senate District 6 special election packet and disclosure calendar](https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2025/Senate_6_special.pdf), letter March 25, 2025, *final two pages*, has **three different due dates**. The [2025 general calendar](https://cfb.mn.gov/pdf/calendars/2025_general_disclosure_calendar.pdf?t=1743206400) separately establishes when ordinary 2025 year-end reports were due. These calendars are **not interchangeable**: no automatic statewide deadline or assumption that a report with `year=25` was public in 2025 is allowed.

| CFB source report | Viewer identity pattern (regnum 19205) | Case-specific actual due | Statutory day following due |
|---|---|---|---|
| Senate 6 pre-special-primary | `25:pcc:C:1:0` | 2025-04-08 | 2025-04-09, 8 a.m. CDT |
| Senate 6 pre-special-general | `25:pcc:E:1:0` | 2025-04-22 | 2025-04-23, 8 a.m. CDT |
| Senate 6 special-election cycle final | `25:pcc:YE:1:0` | 2025-05-27 | 2025-05-28, 8 a.m. CDT |
| Ordinary 2025 year-end | `25:pcc:YE:0:0` | **2026-02-02** | **2026-02-03, 8 a.m. CST** |
| Ordinary 2025 year-end amendment #1 | `25:pcc:YE:0:1` | 2026-02-02 is the *original statutory obligation*; actual amended filing may be later | No earlier than Feb 3, 2026 and **day after independently obtained amendment receipt**, conservatively |

The first three due rules are conditional on the committee's actual special election involvement, source period identity and filing obligations; here the report references are known for registration `19205` only. Special-election cycle final and ordinary calendar year-end are **different reports**. An original filing and an amendment are **not** separate obligatory reports in the denominator.

**Important:** These are the legally prescribed release *floors*, not independent proof that a particular report, as downloaded in **October 2026**, could actually be retrieved on the earliest statutory release day in 2025. Historical as-of may therefore remain **unknown** even when official filed/due dates and a conservative legal floor can be computed.

The [CFB Board's May 14, 2025 meeting materials](https://cfb.mn.gov/pdf/bdinfo/agendas/2025_05_14_materials.pdf) separately reproduce a **registration 19205 / Senate District 6** financial report covering January 1–April 15, 2025, marked **received April 22, 2025**. That is a valuable corroborating later source, but its meeting/publication date is not proof that a copy was independently available on April 23, 2025.

Controlling [Minnesota Statutes §10A.20, subd. 1b](https://www.revisor.mn.gov/statutes/2025/cite/10A.20): ordinary reports remain nonpublic until **8 a.m. the day after the statutory deadline**. The existing helper `cfbElectronicReportAvailableOn(filedOn, dueOn)` also enforces a conservative `filed+1` lower bound if a filing is late. **Same-day target-vote cutoffs are excluded**. 24-hour/next-business-day large contribution notices have a separate publication rule; none of these ordinary-report dates should be applied to them.

## Exact implementation

- `src/evidence/cfb-sd6-2025-report-pdf-probe.ts`: four case-specific, manually reviewed, pinned calendar due-date rules keyed by exact registered candidate/filing year/report period/special-election discriminator; independent, strictly validated CFB report header registration/office/coverage/received-date parser; separately checked calendar PDF text fingerprints and scope; deterministic PDF-to-calendar join. An official downloaded PDF has a SHA-256 of its **actual bytes**, not only of extracted text. Reject mismatched office/registration/period, inverted dates, wrong year, non-PDF downloads and conflicting source captures.
- `scripts/capture-cfb-sd6-2025-report-pdf-proofs.ts`: obtains the exact live CFB viewer reference listing (already tested by #869), downloads up to five report PDFs and the two distinct original CFB calendar PDFs into **temporary process memory only**, hashes them, extracts only report-header data, and reports individual failures. No donor names, addresses, financial row details or PDF source text are written to the artifact or logs.
- `.github/workflows/cfb-sd6-2025-report-pdf-proof-probe.yml`: **one-time** official public-source Actions run on first addition to main, metadata-only artifact, no secrets, no scheduled trigger, and no Neon/Vercel access.
- `tests/cfb-sd6-2025-report-pdf-probe.test.ts`: unit tests for exact report identity/year, early/late filings, amended year-end after 2025, invalid/ambiguous report headers, missing/wrong calendar, and explicit inability to certify past publication/finance row containment.

The calendar parser verifies **the same downloaded official PDF contains the relevant calendar title, date labels and report types**, while the due-to-report association is manually reviewed against the *calendar's actual table layout* and is scoped only to this concrete special election. Text strings merely coexisting in a PDF are not a generalizable algorithm for date/report alignment. For future districts/years, acquire the **independently sourced correct calendar**, verify its table, then add separately reviewed specific rules/tests or an audited table-structure extractor.

Run locally or inspect the one-off [official proof acquisition workflow](../../.github/workflows/cfb-sd6-2025-report-pdf-proof-probe.yml):

```sh
node --import tsx scripts/capture-cfb-sd6-2025-report-pdf-proofs.ts \
  --output /private/cfb-sd6-2025-pdf-and-calendar-metadata.json
```

The output stores per report:
`reportId`, `reportPdfUrl`, original `reportPdfSha256`, `reportPdfBytes`, `sourceReportCoverageStartOn/EndOn`, `officialReceivedOn`, `calendarDueOn`, original `calendarPdfSha256`, **`earliestLegalAndFilingBoundOn`**, validation/failure state, and source retrieval timestamps. Every row explicitly fixes `verifiedHistoricalPublicByOn=null`, `exactFinanceRowContainmentVerified=false`, `historicalAsOfEligible=false`. The report metadata has **`complete=false`**, statewide registered-filer/report denominators remain `null`.

A public-source download failure must be recorded as `pdf_missing_or_invalid` or `calendar_not_verified`; never substitute a report title, transaction date or Board meeting date. The CLI does not touch any database or create an importable automatic eligibility manifest.

## What next and why this is not yet a complete finance repair

1. Confirm the one-time workflow actually downloaded the five PDFs and independently hashed both calendars; investigate and report any inaccessible source as an *explicit source gap*. Do **not** infer a successful download from a passing CI run.
2. Independently prove the original report and amended version as historically publicly available *at the forecast cutoff*, not just statutorily releasable. An archive captured in 2026 does not establish a 2025 capture timestamp.
3. Perform row-level containment checks against independently authorized read-only exported 2021–2025 historical rows. Verify source-to-row identity and compare the actual v6 `availableOn`/eligibility; **do not auto-approve historical eligibility**. The private export and true official full 2021–2025 Senate filer/required-filing denominator have not yet been acquired.
4. Broaden to all legislative candidate committees (including inactive and special election), committees/funds, party units, independent expenditures, and 2021–2024 filing calendars as **separate official source universes**, not as inferred zeros or one combined “contributions” count.
5. Only after explicit owner authorization and independent QA may a separately tested idempotent historical correction be executed. No changes to current serving, frozen predictions, production DB, schedulers or 2027 work.

Issue #864 remains **open** until the actual official completeness denominator and source-to-database reconciliation are established.
