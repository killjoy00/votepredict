# Issue #864 — parallel protected SF1 reconciliation and all 81 original OCR motion-review documents

October 15, 2026. **Historical Senate committee research only, 2022–25.** No 2021 source additions, no floor-vote expansion, no production write, no legacy event ordinal replay, no model or serving changes.

## A. January 24, 2023 — two independently authenticated original SF1 decisions

Merged [#1299](https://github.com/killjoy00/votepredict/pull/1299) fixed the named-Rules narrative parser and verified the raw original [official Rules Minutes PDF](https://www.lrl.mn.gov/archive/minutes/senate/2023/rules/20230124/Rules_20230124_Minutes.pdf), byte length **189,421**, SHA256 `a49a0b9d2abdb716118951de8706faf313463ff43f1ab0f16408326a52fb0379`, embedded-text SHA256 `2a6eb9aced550ed193b4329fd33cc0fa8c59fd447c9be170ccc34ac36ead3544`.

| Distinct original parliamentary motion | AYE | NO | Original result | Explicit source named choices |
|---|---:|---:|---|---:|
| Oral amendment proposing SF1 rereferral to Health and Human Services | 4 | 6 | Amendment not adopted | 10 |
| Motion adopting Judiciary and Public Safety committee report for SF1 | 6 | 4 | Committee report adopted | 10 |

These are *committee motions*, not final Senate floor passage ballots. Old source parser v3 had zero named observations for this original. The actual new original source regression succeeds with two separate anchor fingerprints, 20 printed side-choice occurrences and no inferred attendance or unanimous-member choices.

**New protected source-to-stored audit:** `scripts/audit-senate-864-rules-sf1-protected-neon-readonly.ts` re-fetches and byte/authenticates the same original again, resolves 10 Senate names per roll to independently session-bounded historical membership rows, queries the **existing single verified VotePredict Neon default project/branch**, and compares all same-day Senate committee source documents, event rows, original bill/motion type/tally/outcome and historical member choice sides. It runs only five fixed bounded `SELECT` statements inside an explicit PostgreSQL `REPEATABLE READ READ ONLY` transaction and **ROLLBACK**. It never exports source member lists, historical IDs, existing source URLs, stored event external keys or choice hashes.

The **protected main-only one-shot** is `.github/workflows/senate-864-2023-rules-sf1-stored-readonly.yml` with marker `SENATE_864_2023_RULES_SF1_PROTECTED_PARITY_ONESHOT_20261015_V1`. The secret-bearing step is gated on independent complete exact-main-SHA CI and the existing `evidence-readonly-sandbox` environment. Ordinary PR CI is purely synthetic/read-only static. A successful query can classify motions as `already_stored_exact`, `candidate_add_only_after_separate_approval` or a specific mandatory HOLD for missing original source, historical identity, ambiguous old positional motion, conflict or incomplete database snapshot. **A parser fix alone does not prove database absence.** Any add-only repair would require separate authorization.

## B. All 81 flagged original OCR-linked committee-minute documents

The archived [149 source original audit](./source-proof/senate-864-remaining149-ocr-original-recall-v1.json) authenticated all original PDFs and separately identified **81 distinct flagged documents**, 79 with original printed potential motion/result/roll cues and two where the current context parser newly identifies actions. The frozen earlier review's 28 flags are disjoint, for 109 reviewed flagged documents. This is *not* 109 missing recorded votes. 2021 is excluded throughout.

| Year | Flagged original documents | Count |
|---|---|---:|
| 2022 | Finance; Health & Human Services, Commerce, Human Services Reform, Property Taxes and more | 54 |
| 2023 | Higher Education | 4 |
| 2024 | Higher Education | 1 |
| 2025 | Taxes, Judiciary, Higher Education | 22 |
| **Total** | | **81** |

### Immediate exact original-document priorities

Original printed formal motion-result *cue* counts and current contextual parser candidates are shown separately because neither is a distinct accepted parliamentary motion count.

| Hearing date | Original Senate committee | Printed formal result cues | Contextual action candidates |
|---|---|---:|---:|
| 2022-03-22 | Finance | 11 | 11 |
| 2022-02-09 | Health and Human Services Finance and Policy | 10 | 6 |
| 2022-05-05 | Finance | 9 | 10 |
| 2022-04-05 | Finance | 8 | 9 |
| 2022-05-04 | Finance | 8 | 8 |
| 2022-03-23 | Commerce and Consumer Protection Finance and Policy | 8 | 8 |
| 2022-03-28 | Commerce and Consumer Protection Finance and Policy | 8 | 6 |
| 2022-03-15 | Human Services Reform Finance and Policy | 6 | 8 |
| 2022-03-23 | Labor and Industry Policy | 6 | 8 |
| 2025-01-30 | Taxes | 4 | 4 |
| 2025-04-01 | Taxes | 4 | 4 |

**Complete cluster:** 2022 Finance has 11 original dates (Mar 3, 10, 22, 23, 24; Apr 5; May 4, 5, 10, 12, 18). 2025 Taxes has 11 (Jan 21, 28, 29, 30; Feb 18; Mar 13, 18, 27; Apr 1, 24; May 6).

### Independent second source-movement

`scripts/audit-senate-864-81-ocr-original-motion-anchors.ts` selects the **exact 81** flagged SHA-bound original government PDFs from the 16 pre-existing source-result artifacts. It refuses any missing source, duplicate URL, altered year/SHA, changed frozen 149/81 denominators or 2021 entry. Eight bounded parallel source-only jobs re-fetch every original PDF and require both **identical raw byte SHA** and **identical extracted normalized OCR-text SHA**. They run the existing parser and independent motion-cue detector, emitting **bounded original source offsets, excerpt SHA, nearby printed bill/amendment identifiers, parser classifications and documentary HOLDS**, not names, public votes or database writes. The independent workflow is `.github/workflows/senate-864-81-original-motion-anchor-review.yml`.

The new source cue anchors are only **review slots**, not certified unique parliamentary actions. A review slot cannot become a stable `vote_events.external_key` without exact printed parliamentary action context and later separate stored-motion/person resolution. No PDF silently becomes "no vote" when cues are absent. Because the ZIP artifacts have limited retention, the immutable artifact IDs + SHA digests remain pinned in repository provenance; an expired original must be freshly fetched and verified again.

## Acceptance and genuine remaining debt

Both pipelines are independently tested and must pass their original-source/check suites. The protected SF1 workflow is not complete until its own **actual, successfully rolled-back Neon read-only run** reports the two source-to-stored classifications. The 81 source audit is not complete until **8/8 original-document shards** succeed and the resulting distinct-action audit review queue is examined.

Even then, 323 embedded-text zero-action documents, fourteen original written-minute date gaps, 2021 print records, and 2022 print/electronic differences remain separate #864 scope. No historical committee action should be imported with the old positional `senate-committee:<URL>:<index>` upsert. Do not mark #864 closed on research source coverage alone.
