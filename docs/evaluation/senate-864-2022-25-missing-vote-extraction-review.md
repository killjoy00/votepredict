# #864 Senate committee — audit for all missing votes, 2022–2025

*2026-10-14 independently calculated from the original SHA-verified [1,592-meeting / 1,452-PDF action ledger](https://github.com/killjoy00/votepredict/actions/runs/38314080633). Not a certified official all-vote denominator, not a live production-DB report.*

## Important correction: original minutes coverage is not vote-extraction completeness

The original LRL minutes index identifies **1,592** committee/date meetings and **1,451** with original linked written-minute PDFs, comprising **1,452 independently authenticated original PDF bodies**. Subsequent official government source recovery authenticated **111** additional Clerk-minute HTML bodies and **one** unlinked original Housing PDF. **1,563/1,592 written minutes available**, 29 original written-source holds ([one-to-one 141 original no-linked-PDF crosswalk](./source-proof/senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json)).

**A separate extraction problem:** of the **1,451 linked-PDF meeting days, 568 have zero parser-recognized actions**. These may be discussion-only meetings, inadequate OCR, missing parser grammar or real missed actions. **Do not call these 568 "missing votes" without reading their original Minutes.** Of them, **197** involved initially low-text OCR-recovered source minutes (the high-priority queue) and **371** had embedded text and no parsed action. This complete zero-parser-action inventory is reproducible from the immutable original 1,592-meeting JSON ledger and the attached full-index audit.

| Year | Indexed meeting dates | Linked Minutes dates | Parser finds no action | No-action OCR subset | No-action embedded-text subset | Frozen PDF named rolls |
|---|---:|---:|---:|---:|---:|---:|
| 2022 | 337 | 325 | 202 | 113 | 89 | 28 |
| 2023 | 517 | 453 | 131 | 22 | 109 | 22 |
| 2024 | 300 | 258 | 66 | 13 | 53 | 25 |
| 2025 | 438 | 415 | 169 | 49 | 120 | 29 |
| **Total** | **1,592** | **1,451** | **568** | **197** | **371** | **104** |

The already authenticated original linked-PDF parser-v2 ledger contains **104 named roll candidates/989 printed named-choice occurrences, 49 count-only roll candidates, 1,519 voice votes, six unanimous and 3,000 result-only action candidates**. Subsequent original PDF parser-v3 recognizes **112** named-roll candidates, an increase of eight, including four distinctly numbered and independently validated February 14 2024 Education Policy amendment actions. Another four PDF source-parser gains remain without complete old-to-new original action mapping.

Alternative original 2024/25 Clerk minutes contain **27 explicitly named roll-source candidates and 343 printed named-choice occurrences**. Combining current PDF parser-v3 and new Clerk observations gives **139 named roll-source candidates**, **not 139 missing stored votes**. The frozen v2 PDF 989 + new Clerk 343 supplies **1,332** printed named-choice *occurrences* before counting the eight additional v3 actions, which are not yet reconciled per motion to historic member IDs and existing DB event keys.

The independently distinct alternate Clerk cohorts have **33** first 2023 action candidates, **111** subsequent 2023 action candidates, **129** original 2024/25 high-gap action candidates; these 273 parser observations are non-exhaustive and include result-only/context observations. Another 15 alternate Clerk bodies have 10 result-text signals **not certified as distinct motions**. The official orphan 2022-03-24 Housing PDF proves two layover motion proposals but **neither outcome nor named votes**. No claim of complete motion denominator.

## Immediate extraction review priorities

The **197 source-authenticated OCR meeting dates with no recognized parliamentary action** lead the review queue. Large focused clusters are:

| Year | Committee | OCR originals with no parsed action |
|---|---|---:|
| 2023 | Higher Education | 22 |
| 2025 | Higher Education | 18 |
| 2022 | Agriculture and Rural Development Finance and Policy | 15 |
| 2022 | Energy and Utilities Finance and Policy | 15 |
| 2022 | Finance | 15 |
| 2025 | Taxes | 15 |
| 2022 | Health and Human Services Finance and Policy | 13 |
| 2022 | Human Services Reform Finance and Policy | 13 |
| 2025 | Judiciary and Public Safety | 13 |
| 2024 | Higher Education | 11 |

The **371 embedded-text dates with zero actions** come next. [The underlying source meeting-level action ledger](https://github.com/killjoy00/votepredict/actions/runs/38314080633) supplies per-original PDF URL/byte SHA, committee, year, hearing date, extraction method and candidate action counts, so review can happen by original document without reconstructing identity.

## Evidence integration, safe gates and unresolved database parity

1. **Source proof integration:** [PR #1272](https://github.com/killjoy00/votepredict/pull/1272) merged the full source index/committee-year ledger; [PR #1275](https://github.com/killjoy00/votepredict/pull/1275) merged the initial 14 original 2023 Clerk minutes. [PR #1292](https://github.com/killjoy00/votepredict/pull/1292) consolidates subsequent 44 2023 Clerk minute originals, 38 high-gap originals, 15 other 2022/24/25 Clerk originals, independent 2022 Housing PDF, a complete 141-row Clerk/PDF source crosswalk and the original-vote extraction audit.
2. **Original paper recorded roll call proof:** each new actual member vote must have a unique original motion anchor, source byte SHA, exact original printed tally and individual YEA/NAY names, date, committee, bill/amendment context and independently matched hearing-date historical membership. Attendance, mover, sponsor, party, aggregated votes and voice decisions do not supply named member sides.
3. **Stored-row reconciliation:** compare original sources to current deployed VotePredict source_documents/vote_events/member_votes in bounded **READ ONLY / ROLLBACK**; differentiate exact previously stored motions from genuinely missing named votes. Earlier protected historical PDF-v2 comparison found **152/153** roll candidates and **979/989** source choice occurrences matched in an existing default Neon branch; one 2024 original YEA was absent. It was never independently proved to be the deployed production branch. New source observations have **not** yet been reconciled to current DB records.
4. **No legacy replay:** previous importer uses `senate-committee:<source URL hash>:<parser position>` and `ON CONFLICT DO UPDATE`. A different parser ordering can replace the wrong parliamentary motion. New [stable-original-action add-only planner](../../src/evidence/senate-864-verified-motion-addition-plan.ts) compares exact source hashes, distinct motion context/position and fully matched historical memberships before proposing a new original key, and holds ambiguous old positional events. It does NOT insert records.
5. **Actual private-store source coverage:** the new [original Clerk source-to-stored audit](../../src/evidence/senate-864-clerk-written-source-db-audit.ts) checks each of the **112** newly recovered written-minute original source bodies against the existing VotePredict default Neon database using **source URL/ID, exact original SHA and indexed committee/date**, emits only category counts and never writes. It is gated behind separately passing main CI and the existing protected `evidence-readonly-sandbox` environment.
6. **Next source review:** highest priority is the 197 initially OCR-recovered zero-action meeting dates, then the 371 embedded-text zero-action dates, then the remaining four unexplained v3 original roll gains and the 2024 original YEA missing from the earlier database snapshot. Separate source-only pursuit of the 29 remaining written-minute dates remains worthwhile.

**Status:** 2021 omitted entirely from active scope. No source-only candidate observation is a mechanically actionable prediction position, no publication clock time is inferred, no same-day forecast eligibility, no database backfill/retraining/deploy/scheduler. Issue #864 stays open until actual source-to-existing-motion/member parity and missing-action remediation are independently established.
