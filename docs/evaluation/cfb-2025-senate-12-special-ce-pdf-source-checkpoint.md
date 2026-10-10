# #864 — permanent verified source checkpoint for twelve 2025 Senate special-election C/E PDFs

**Status: bounded source-authentication milestone, not statewide completeness or historical as-of eligibility.** The twelve original-version pre-primary (C) / pre-general (E) viewer references identified in the October 10, 2026 source inventory were fetched and independently checked against original CFB PDF headers and district-specific official calendars. All twelve report PDFs and three official calendar PDFs passed the acquisition and authentication gates. This work was executed in [merged PR #941](https://github.com/killjoy00/votepredict/pull/941) and [official GitHub Actions source run 38087106096](https://github.com/killjoy00/votepredict/actions/runs/38087106096). Full repository CI on the exact PR head passed.

## Source artifact and durable evidence

The original Actions evidence artifact ID **11682778548** expires November 9, 2026, so its independently checked provenance is preserved in [the permanent checkpoint JSON](source-proof/cfb-2025-senate-12-special-original-pdf-source-checkpoint.json) and [the exact twelve-PDF source ledger](source-proof/cfb-2025-senate-12-special-original-pdf-source-ledger.psv).

- One-time original metadata-only ZIP SHA-256: e2ba145c819586e21065559a2a82f7f740448b507ba51ceaca7dba79f91639eb
- Original extracted 24,337-byte JSON SHA-256: 5925fdfc2b0fee6ab5ed352fd1a903e3a9c16f91607854eefb2bb9d9ac196c58
- Permanent 1,770-byte canonical twelve-report PSV SHA-256 without the final newline: 5048b6fa2220a92a6e6a61484f49a224c3fd60fc4e5900d42e6f31c9852517b9
- Parent 85-version reference ledger SHA-256: d34bb475cccd94481fd2f2215bf47e3c9695ad328e06bed2475967add067f0d0

The compact ledger lists the exact official viewer report-version identifier, independently verified Senate district, report PDF byte hash and length, coverage start/end, official Board receipt date, independent official calendar deadline, and earliest conservatively derived statutory/filing not-before date. It contains no contributor names, transaction data, addresses or raw PDF text. Binary PDF bodies remain at the original public CFB URLs, not in this repository.

| District | Original C versions authenticated | Original E versions authenticated | Total |
|---|---:|---:|---:|
| 6 | 3 | 2 | 5 |
| 29 | 2 | 2 | 4 |
| 47 | 2 | 1 | 3 |
| **Total** | **7** | **5** | **12** |

All **7/7** independently dated 2025 committee source-viewer API body hashes still matched their pinned original source snapshots. All **12/12** report PDFs had unique binary SHA-256 hashes, structurally valid source headers, independently confirmed registration, Senate district, report period end, Board receipt date and matching calendar identity/due date. All **3/3** official calendars were downloaded and checked against the separately transcribed period-specific dates. There were no acquisition failures or unresolved report-header identities in this bounded tranche. Two of the twelve reports were independently proved earlier as the District 6 control (registration 19205), so the tranche adds **ten previously unauthenticated original-version reports** to that earlier control set.

## Critical historical availability limitation

The independently verified CFB 2025 due dates and conservative earliest legal/filing bounds are:

| District(s) | C due date | C not-before floor | E due date | E not-before floor |
|---|---|---|---|---|
| 6 | April 8, 2025 | April 9, 2025 | April 22, 2025 | April 23, 2025 |
| 29 and 47 | August 19, 2025 | August 20, 2025 | October 28, 2025 | October 29, 2025 |

For this batch, source-verified Board receipt dates were no later than the independent due dates. Under the existing legal release-floor rule, these dates are **not-before constraints only**. Neither a PDF retrieved in 2026 nor a filing date or calendar statutory floor independently demonstrates that the specific version was **public by** that date in 2025. This checkpoint establishes **zero new independently verified historical public-by dates**. It does not make any finance evidence eligible for historical predictions, including same-day cutoffs.

The official viewer's amendment number 0 identifies an **original-version reference**, not independent checkbox-based proof that the PDF was never amended. It does not establish whether the committee was legally obligated to file that report given its ballot and special-primary circumstances. Amendments remain separate report versions; the 25 amended viewer references from the 41-registration cohort have not been authenticated by this twelve-original-PDF checkpoint.

The earlier District 6 special-election final-report May 14 versus May 20 period-end discrepancy remains unresolved. This C/E pilot deliberately did not adjudicate or reuse a guessed final-report date.

## Remaining issue #864 requirements

The source inventory's **seven special-election final YE original-version references** and **41 ordinary YE original-version references** remain priorities for exact original-PDF, registration, period and independent calendar verification. Separately establish historically dated registration and termination episodes for all relevant Senate committees, actual ballot applicability, legally required filing counts, missed or late filings, original-versus-amendment versions, independently documented historical public-by dates and source-to-database row containment before certifying statewide 2021–2025 completeness. The official legally owed and actually filed statewide report denominators remain explicitly **null**, not inferred from source viewer counts.

This checkpoint performed no Neon or Vercel production reads or writes, no backfill, scheduled job, live forecast change, model retraining, 2027 program change or disclosure of raw campaign finance data. **Issue #864 remains open.**
