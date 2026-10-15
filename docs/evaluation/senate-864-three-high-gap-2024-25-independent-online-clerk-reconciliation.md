# Issue #864 — 2024–25 large no-PDF Senate committee groups: source-completeness audit

**Scope:** Minnesota Senate historical committee source evidence, 2021–2025. This is public-original-source research on the three largest user-prioritized 2024–2025 LRL no-linked-Minutes-PDF groups. It is not a production member-vote import, model run, scheduler, historical publication-by certification, or exhaustive motion/meeting proof. Follow original issue #864 and the [independent meeting-to-PDF committee-year ledger in PR #1272](https://github.com/killjoy00/votepredict/pull/1272). Keep issue **OPEN**.

## Actual official electronic meeting denominator, *not* five-year print completeness

The existing separately SHA-authenticated 99 official LRL committee-year index pages identify **1,592** exact indexed 2022–25 committee/date meetings, **1,451** with linked official Minutes PDFs, **141** without linked official Minutes PDFs, and **1,452** original government PDF bodies (2023 has two PDFs for one indexed meeting). The 1,452 originals are separately SHA validated, including all 207 initially low-text OCR recoveries. These counts are government-index denominators, not database row denominators. Alternative Senate Clerk meeting-Minutes HTML is an independent official source format and can address a missing *LRL PDF link* without implying the LRL has a PDF.

| Year | LRL indexed committee meetings | With linked Minutes PDF | No linked Minutes PDF | Of no-PDF meetings, independently authenticated alternative Clerk HTML | No original linked PDF or independently authenticated Clerk HTML in current scope |
|---|---:|---:|---:|---:|---:|
| 2021 | **unknown: printed Minutes only** | unknown | unknown | 1 separately dated 2021 online hearing is not a printed universe | **unknown** |
| 2022 | 337 | 325 | 12 | 0 in this research | 12 |
| 2023 | 517 | 453 | 64 | 14 | 50 |
| 2024 | 300 | 258 | 42 | 25 | 17 |
| 2025 | 438 | 415 | 23 | 13 | 10 |
| **2022–25** | **1,592** | **1,451** | **141** | **52** | **89** |

The 14 authenticated 2023 online Clerk originals are proven in [PR #1275](https://github.com/killjoy00/votepredict/pull/1275) with separate complete 64-row crosswalk and SHA receipts. The additional 38 recovered Clerk originals in 2024/25 are independently proven in the [frozen 53-meeting source receipt](./source-proof/senate-864-three-high-gap-2024-25-original-source-receipts.json). Their **original hearing days are real source dates**; first historical web-page publication dates remain unknown. Zero extractor-recognized actions on an authenticated Clerk source does **not** establish zero official motions or votes.

Official LRL explicitly states that Senate printed Minutes were held at LRL through 2022, the Senate switched to electronically collected Minutes beginning in 2022, and 2022 print/electronic collections can differ ([LRL official minutes guide](https://www.lrl.mn.gov/minutes/Default)). The **2021 printed all-committee meeting/action denominator** and **2022 full print/electronic parity** are unresolved. The separately authenticated 2021 Senate Journal/online source **12 named roll motions / 103 named choice occurrences** are selected partial evidence only, not 12 reconstructed historical committee meeting days.

## Three highest-value owner-selected no-PDF groups, verified source originals

| Indexed committee and year | Exact original LRL no-PDF meeting identities | Authenticated other-format original Senate Clerk Minutes | Still without authenticated Clerk original | First-pass recognized source motions | First-pass explicit named roll candidates |
|---|---:|---:|---:|---:|---:|
| 2024 Taxes | 23 | 12 | 11 | 59 result-only | 0 |
| 2024 State and Local Government and Veterans | 13 | **13** | **0** | **46** (19 result-only, 27 named) | **27** |
| 2025 Energy, Utilities, Environment, and Climate | 17 | 13 | 4 | 24 (18 result-only, 1 count-only, 5 voice amendments) | 0 |
| **Selected subtotal** | **53** | **38** | **15** | **129 currently recognized candidates** | **27 authenticated named-roll candidates** |

The revised original-source named rolls total **27 distinct source candidates and 343 explicitly printed named YEA/NAY choice occurrences**, compared with the frozen v1 first-pass 15/191 (**+12 named rolls / +152 choice occurrences**). No independently proved historical person-ID resolution, production stored event/motion reconciliation or import exists; these are **not** 343 newly stored member choices. Original Clerk body SHA and normalized-text SHA, exact printed committee/day, calendar committee/hearing-ID crosswalk and source category totals are frozen for every meeting in the [53-row receipt](./source-proof/senate-864-three-high-gap-2024-25-original-source-receipts.json). [Original 53-source Actions run #38356266030](https://github.com/killjoy00/votepredict/actions/runs/38356266030) successfully re-acquired 38 Clerk originals; a follow-up source recheck also succeeded as [run #38356613283](https://github.com/killjoy00/votepredict/actions/runs/38356613283).

**New named-roll undercount found in original Clerk source:** The official [March 14, 2024 State/Local Government/Veterans original hearing #18532](https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=18532&ls=93) has **five explicitly printed Ayes/Nays roll-call blocks** (SF3787 A11, A10 and subsequent bill decision, separate SF3986 and SF3561 decisions), whereas the frozen original first-pass manifest recognizes **three** for that day. The old source parser required a nearby `Senator moved` phrase even when official minutes instead say `requested a roll call`. This discrepancy is independent of the earlier one missing stored 2024 YEA from the **LRL PDF** source-to-Neon parity audit. A narrowly scoped source-grammar repair and five-motion synthetic regression are in this PR. The [subsequent independent v2 original-source run #38501257729](https://github.com/killjoy00/votepredict/actions/runs/38501257729) has **succeeded** and independently re-authenticated **the same 38 original Clerk HTML SHAs**, recognizing **27 named-roll candidates / 343 printed choice occurrences**. Its [per-meeting permanent v2 source receipt](./source-proof/senate-864-three-high-gap-2024-25-original-source-receipts-v2.json) includes all 53 source identities and seven exact changed dates; the archived v1 receipt remains unchanged. The final source-grammar v2 re-read, its 12/12 parser regressions, and original-source checksum verification succeeded. It also confirms that the 2024 March 14 SF3561 bill-passage named roll has no amendment label and is separate from the earlier A14 voice amendment. Preserve distinct SF3787 amendment labels, source order and original tally, never map by positional backfill IDs.

### Exact new original named-roll source discoveries

The seven affected 2024 State/Local Government/Veterans original hearing dates are **March 12 (+3 named rolls / +39 named choice occurrences); March 14 (+2/+26); March 19 (+2/+24); March 21 (+2/+27); March 26 (+1/+13); April 9 (+1/+11); and April 16 (+1/+12)**. Other original official source meeting/date records did not change named-roll counts. There were **zero underlying Clerk HTML or normalized-text SHA changes** from the frozen first-pass receipts, so these are controlled parser grammar recoveries, not substituted source bodies. [Permanent per-day v2 proof](./source-proof/senate-864-three-high-gap-2024-25-original-source-receipts-v2.json), [successful original re-extraction run #38501257729](https://github.com/killjoy00/votepredict/actions/runs/38501257729), [raw original Clerk per-action artifact #11866375427](https://github.com/killjoy00/votepredict/actions/runs/38501257729/artifacts/11866375427).

The original source can print a preceding amendment adopted by voice and then a separately requested named vote **on bill passage**. The revised parser now protects that distinction instead of carrying the previous amendment label forward; for instance, the 2024 March 14 SF3561 final-passage decision cannot be identified as the earlier A14 voice amendment. This is a source-label correction, not an invented additional named roll or proof of historical member-ID parity.

## Two additional original official Bill Logs — 14 unverified Clerk days, *no roll-call implication*

Unlike Clerk parliamentary Minutes, the archived official LRL **Bill Log** PDFs provide only bill-specific date and handling status. They cannot prove unique formal motions, a named roll call, or how any member voted. They are useful supplementary corroboration for the 14 of 15 remaining no-Clerk original dates where a unique calendar hearing ID was independently available.

| Original government source | Missing-Clerk indexed meeting dates cross-referenced | Separately SHA-authenticated original PDF | Date/bill/status observations | Substantive source limitation |
|---|---:|---:|---:|---|
| [2024 Taxes Bill Log](https://www.lrl.mn.gov/archive/minutes/senate/2024/taxes/taxes_2024_Bill-Log.pdf) | 11 | 76 pages; SHA `ac52199cd91e…85bf5a12e3` | 63 | Bill handling only; some records say laid over/not heard |
| [2025 Energy Bill Log](https://www.lrl.mn.gov/archive/minutes/senate/2025/energy/energy_2025_Bill-Log.pdf) | 3 | 9 pages; SHA `8bbb79ed3583…e92f278` | 7 | Bill handling only; no roll-call evidence |
| **Total** | **14** | **2 complete original-PDF SHA proofs** | **70 status observations** | **0 proven named positions; 0 unique vote-event certifications** |

Original [successful source-only run #38356613399](https://github.com/killjoy00/votepredict/actions/runs/38356613399), artifact 11793330192, archive digest `sha256:758e0d0d8968018a3751fb8f254f32a04c3b7e25646f66f955334623bfb7fcb5`, independently recorded the full original-PDF SHA, extracted-text SHA, page counts and 14 per-day bill-status counts. The per-day immutable typed counts and original PDFs are now pinned in [permanent bill-log source-proof manifest](./source-proof/senate-864-2024-25-high-gap-official-bill-log-original-source-receipt.json), with an additional exact-date, SHA and non-inference regression test. A later independently attempted re-fetch failed due to transport errors (the successful original provenance is retained rather than replaced by unsupported absence). The **15th** Clerk HOLD, 2025 Energy on **April 28, 2025**, still lacks an unambiguous government-calendar hearing ID and is not covered by these two original log source-day sets.

## Source-to-motion/storage layers and safe reprocessing

1. Government LRL linked-Minutes record: 1,452 government original PDF whole-byte SHA proofs, 1,592 independent meeting-index identities and 99 committee-year denominator summaries in PR #1272. Raw-original/OCR source and parser observations are *not automatically full distinct official recorded-motion enumerations*.
2. Independently authenticated alternate Clerk originals: 52 additional 2023–25 no-PDF indexed meetings, separately SHA pinned as 14 2023 and 38 2024–25. The independently versioned Clerk source passes give **33 + 129 = 162** provisional action candidates (31+96=127 result-only, 2+1=3 aggregate count-only, 5 voice amendments and **27** explicitly named roll candidates). The earlier **33 + 117 = 150** count is retained as an archived first-pass benchmark, not the current ceiling.
3. Government Bill Logs: 70 original date/bill/status **context entries**, **not** added to the 150 source-motion candidates or used to infer attendance/senator sides.
4. Original-publication timing: committee-action occurredOn uses **actual hearing date**, and owner project convention may give hearing-date historical availableOn, but *none of the re-acquisition timestamps proves the exact original PDF or HTML public-by date*. Same-day cutoffs are excluded.
5. Database evidence parity and historical member-day attribution: remain **UNPROVEN** for newly recovered alternate Clerk motions and for parser-v3 source-only candidate gains. Frozen legacy PDF URL + positional parser event keys are **unsafe to replay** on a changed parser. Only separately approved protected read-only anchor reconciliation may precede any planned write.

## Remaining exact-source gaps and stop conditions

**Priority 1:** Independently verify the latest bounded named-roll parser head and its 27 source candidates against the versioned source receipts. Prove each original YEA/NAY block with one unambiguous printed disposition, source hearing/committee/day, exact tally and no duplicated source occurrence. For source positions that cannot be tied to an exact parliamentary action, hold the event identity rather than guessing. **Do not map the 191 first-pass named-choice occurrences to historical member_id rows without independent source-day identity proof.**

**Priority 2:** Eleven 2024 Taxes and four 2025 Energy exact indexed hearings still lack authenticated Senate Clerk written Minutes. The two original Bill Logs improve contextual coverage for 14 dates but do not remove these 15 recorded-action holds. The last April 28 Energy meeting requires an independently proved hearing ID or a genuinely different primary original. Stop on an unmatched, canceled-only or cross-committee calendar/audio lead.

**Priority 3:** Maintain independent 99 committee-year 1,592-meeting ledger with 52 separately sourced alternate Clerk minutes and 89 still no-original-minutes meetings, keeping 2021 print universe unknown. Continue with public originals only. Do not rerun unavailable 2022 print retrieval or lower-priority 50 2023 Clerk leads without a new method and priority mandate.

**Priority 4:** Original 2024 named-YEA PDF-to-stored one-choice mismatch remains a **protected read-only historical roster HOLD**, unrelated to new Clerk named rolls. No person-identity coercion, event rekey, production writes, model retraining, scheduler or deployment.

## Verification and code

[PR #1276](https://github.com/killjoy00/votepredict/pull/1276) is stacked on [PR #1275](https://github.com/killjoy00/votepredict/pull/1275); separate [PR #1272](https://github.com/killjoy00/votepredict/pull/1272) holds the 1,592-source meeting-level / 99 committee-year ledger and all 2021 partial source rolls. Independent original-source and synthetic jobs must be green **on the exact eventual PR head** before calling this accepted or merged. GitHub CI transport failure or rate-limited unrelated container pull is an infrastructure HOLD, not false evidence of zero documented votes.

Issue #864 stays open. The approved scope explicitly excludes external governmental contact, floor expansions, current production database writes, stored-row reingestion, prediction-model retraining, deployment and scheduler activation.
