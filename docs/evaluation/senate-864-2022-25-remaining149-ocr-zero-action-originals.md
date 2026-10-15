# #864 — third SHA-authenticated Senate zero-action minute audit (remaining 149 OCR originals)

**Scope:** Minnesota Senate original 2022–2025 written committee Minutes only. **2021 is excluded.** This is an independent original-source/parser recall, not a source-to-stored-member-vote reconciliation, historical reimport or a “no action took place” certificate.

## Fixed, independent denominator and disjoint audit

The official LRL-index-derived SHA-pinned research inventory has **1,592 indexed meeting dates**, **568** originally zero-parser-action linked-PDF meeting dates, of which **197** were originally OCR recovered and **371** had embedded text. The original stratified 32-PDF audit reviewed **4 OCR and 4 embedded per year**, and the second disjoint 64-PDF audit reviewed **8 additional OCR and 8 additional embedded per year**. Those first 96 audits identified 28 sources with potential motions/current-parser gains for later detailed review, but did not certify the number of missed distinct parliamentary votes.

| Hearing year | All original zero-parser-action OCR dates | Previously sampled OCR dates | New OCR originals to review | Fixed shards |
|---|---:|---:|---:|---:|
| 2022 | 113 | 12 | 101 | 10 |
| 2023 | 22 | 12 | 10 | 1 |
| 2024 | 13 | 12 | 1 | 1 |
| 2025 | 49 | 12 | 37 | 4 |
| **2022–2025** | **197** | **48** | **149** | **16** |

The third review adds a fail-closed selector `selectSenate864RemainingOcrOriginals`. It replays the first 32 and next64 deterministic selections against the same immutable SHA-bound 1,592-date original index, subtracts the already reviewed OCR PDF URLs, and partitions **every** remaining OCR original exactly once. Tests enforce the fixed date- and year-based denominator, SHA/URL integrity, exact per-year totals, non-overlap, shard bounds and complete union. This cannot silently skip an inconvenient date.

## Independent original-source execution

[The source-only GitHub Actions workflow](../../.github/workflows/senate-864-remaining149-ocr-original-source-recall.yml) creates 16 bounded year/shard jobs, with at most three concurrent workers. Each obtains the original independent GitHub Actions census/action ledger artifact from run [#38314080633](https://github.com/killjoy00/votepredict/actions/runs/38314080633), checks the original ZIP digest `sha256:f801aac6a68f6d57d12ea544548860a3f6f2e57b858035f8468068fce6007fe5`, then retrieves each official LRL government PDF anew. Every PDF byte body must match its previously authenticated individual SHA-256 before extracted text, OCR, or parser observations are considered. No source PDF or printed individual member choice list is uploaded.

For every original, the report records year, indexed committee and hearing date, original official URL/SHA, reverified PDF byte count and text SHA, extraction method, current parser named/count-only/context *candidate* counts, original motion/result/voice/roll cues and a review priority. Personal voting identities and original PDF bytes are not exported. A job fails when any source body cannot be byte-verified; the diagnostic report is retained as a 30-day Actions artifact. Source-recorded aggregate, voice, absent or attendance evidence never establishes an individual YEA/NAY.

## What can be claimed afterward

- A **successful 16/16 original source suite** would establish a fresh, independently raw-SHA-verified motion-cue/parser recall for **all 197** originally zero-action **OCR** linked-PDF meeting dates. Together with the other 48 embedded-text samples, it would mean **245 / 568** original zero-parser-action minutes reviewed by this audit design, leaving **323 embedded-text original minutes** still unaudited in this series.
- The 149 third-wave PDFs have **not been freshly rechecked until these jobs report success**. No count of newly discovered motions or named member choices may be inferred from the sampling plan itself.
- A successful audit is **not** certification of full recorded-motion extraction. Even a PDF without a detected cue may record an action missed by all heuristics. Flagged cases still need their exact, distinct printed motion anchors, outcome and (for individual votes) printed member names/tallies and independently proven historic membership.
- **Source-to-stored motion parity remains a separate gate.** Never replay legacy `senate-committee:<URL hash>:<parser position>` keys or perform `ON CONFLICT DO UPDATE` backfills from a changed parser. Do not write Neon, retrain or deploy from this source-only workflow.

**Stopping conditions:** Keep the original PDF/date/source as HOLD if raw-byte SHA, original indexed identity or text extraction fails. Hold all individual vote rows where the source motion/result, named sides, full tally or historical member identity is ambiguous. Any change to 1,592, 568, 197, 96 or the source SHA manifest requires an explicitly reviewed baseline revision, not auto-adjustment to make a test pass.

[Issue #864](https://github.com/killjoy00/votepredict/issues/864) remains open. The 14 missing written-minute dates and the other recovered named-roll candidates remain separate from this targeted original OCR recall.

## Executed October 15 source result — no PDF holds, 81 review documents

**The prospective source run described above has now passed:** [GitHub Actions #38755921210](https://github.com/killjoy00/votepredict/actions/runs/38755921210) succeeded on PR #1298 source commit `76c90534d4ba243c36dff28d6cc80c31f7bd1b98`. All 16 independent official PDF SHA-bound shards succeeded, alongside the exact-head general CI and previous 32/64 source regression workflows. Independently downloaded all 16 original artifact ZIPs; full ZIP SHA digests, artifact IDs, years/shards and bounded numerical results are pinned in [the permanent 16-artifact checkpoint](./source-proof/senate-864-remaining149-ocr-original-recall-v1.json).

| Year | Independently whole-PDF SHA reverified | Source documents flagged for action-level review | Current parser context action **occurrences** | Printed formal motion result **text cues** | New named-roll parser observations |
|---|---:|---:|---:|---:|---:|
| 2022 | 101 | 54 | 179 | 162 | 0 |
| 2023 | 10 | 4 | 7 | 7 | 0 |
| 2024 | 1 | 1 | 4 | 4 | 0 |
| 2025 | 37 | 22 | 45 | 34 | 0 |
| **All** | **149** | **81** | **235** | **207** | **0** |

Of the 81 flagged *documents*, 79 had candidate original roll/result/motion signals and two were flagged because the newer contextual parser recognizes actions that the frozen source parser did not. Another 68 reverified documents yielded no detected motion/roll cues, **not affirmative proof that their meeting had no votes**. All 149 full original government PDF SHA values matched; zero source transport, OCR or integrity HOLDS. Current named-roll and count-only roll parser observations in this third OCR tranche are both **zero**, so zero additional member-specific votes have been justified by this scan alone.

The largest distinct-document review clusters are 2022 Finance (11), 2025 Taxes (11), 2022 Health and Human Services Finance and Policy (8), 2025 Judiciary and Public Safety (7), 2022 Property Taxes subcommittee (7), and 2022 Commerce/Human Services Reform (6 each). The first detailed-pass priorities are the largest exact original cue counts: **2022-03-22 Finance (11 original formal-result textual cues)**, **2022-02-09 Health and Human Services (10)** and **2022-05-05 Finance (9)**. Formal-result cues may contain repeated text or several references to one parliamentary action; they must be segmented against each original motion and not counted as independent stored vote events.

**Now verified in this audit design:** 96 earlier + 149 newly reviewed = **245 of the original 568** parser-zero-action linked-PDF dates with independently authenticated original review, of which all original 197 OCR dates were included; **323 embedded-text dates** remain outside this particular stratified series. Earlier 28 flagged source documents plus this 81 = **109 distinct flagged review documents** (the samples are disjoint); this is not 109 missing recorded votes. All historic printed-motion/individual-choice and deployed database reconciliation blockers from #864 remain in force.
