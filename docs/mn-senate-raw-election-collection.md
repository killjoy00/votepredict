# Raw Minnesota Senate district election results (2020–2026)

This collector stores **raw Secretary of State by-district Senate returns** from **2020 onward**. It does not audit published values, change forecasting, or create person matches beyond existing exact unique membership links. The 2016–2019 legacy archive, alternate PDFs and academic fallback are intentionally outside scope. The Secretary of State's pre-2020 automated request protection must not block collection.

## Commands

```sh
npm run data:senate:elections -- --year 2020 --dry-run
npm run data:senate:elections -- --all --dry-run --out mn-senate-raw.jsonl
npm run data:senate:elections -- --year 2025 --no-primaries --dry-run
```

Omit `--dry-run` only for a disposable or otherwise explicitly authorized database. Never commit captured raw base64 sources or local credentials.

## Source coverage

Required: both statewide Senate generals (67 districts on 2020-11-03 and 2022-11-08), the 2024-11-05 special (1 district), and 2025-01-28, 2025-04-29 and 2025-11-04 specials (1, 1, and 2 districts). Total **6 general/special source events, 139 district-election contests**. Missing any required source fails the collector, CI and protected deployment.

Primaries are *best effort*, including special primaries. Missing an optional primary does **not** fail required coverage. No 2026 general is collected before the November 2026 election.

A prior public-only SOS collection produced these indicative 2020+ records. They are source observations, **not a production readback**:

| Year | General/special district contests | Primary district contests | Raw candidate rows |
| --- | ---: | ---: | ---: |
| 2020 | 67 | 16 | 265 |
| 2021 | 0 | 0 | 0 |
| 2022 | 67 | 24 | 273 |
| 2023 | 0 | 0 | 0 |
| 2024 | 1 | 1 | 7 |
| 2025 | 4 | 4 | 37 |
| 2026 (through October 15) | 0 | 15 | 48 |
| **Total** | **139** | **60** | **630** |

Original bulk source responses and SHA-256 are saved in additive `mn_senate_election_source_snapshots` and candidate lines in `mn_senate_election_raw_results`. The January 28, 2025 SOS file uses the original `20250128_27/stsenate.txt` filename. Terms before August 2022 are distinguished from the post-redistricting map.

## Protected production path

Merge PR #1327 to `main` by merge commit, with `SENATE_ELECTION_RAW_PRODUCTION_20261015` in the merge **commit message**. The reviewed main **push, first run attempt**, and exact SHA/source guards run independent tests, all 18 migrations on disposable PostgreSQL, an audit and public source collection without Neon credentials. Only after success may the protected `evidence-readonly-sandbox` environment use the existing Neon secret and verified default project/branch.

The guarded deploy checks that the production ledger already contains the first 17 correct migrations, applies **only 0018**, imports idempotently, and performs a rollback-only readback of per-year raw Senate district and candidate counts. It must not alter serving or model tables. If the attempt fails, make and review a fix in a **new PR**, then merge another main commit with the marker; do not re-run an old secret-bearing attempt or weaken controls.
