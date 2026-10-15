# VotePredict #864 — 830 indexed, 590 downloaded Senate CFB report versions (V40)

Updated October 14, 2026 (government-source fetch timestamps October 15 UTC). **Research branch only: [PR #1287](https://github.com/killjoy00/votepredict/pull/1287), unmerged.**

The original 70 Campaign Finance Board (CFB) 2025-serving Senate candidate viewers exposed 130 exact 2025 year-end report version references. 21 were already known and 109 newly indexed refs were added to the [V38 immutable source ledger](source-proof/cfb-2021-25-95-senators-830-indexed-480-downloaded-v38.psv). [Read-only public original government source acquisition run 38679551930](https://github.com/killjoy00/votepredict/actions/runs/38679551930) recovered **all 109 2025 source PDFs**, without relying on text extraction. Each version is recorded with complete source PDF SHA-256, byte length, exact CFB version reference and original candidate committee registration. **102 complete distinct PDF bodies** were observed; **seven additional indexed versions link to a byte-identical PDF within the same candidate committee**. No cross-committee SHA collision occurred. The indexed amended versions are still counted as version references, not separately summed financial contributions.

Independently, [Newton 2021 original government YE source run 38665626124](https://github.com/killjoy00/votepredict/actions/runs/38665626124) and [repeated source run 38665734833](https://github.com/killjoy00/votepredict/actions/runs/38665734833) both downloaded the exact original **Jerry Newton** YE registration 18004 PDF with identical SHA-256 `21537d694379020977f027e1a337c3f6d1d84d0c18cab9a708e7da73c6af6b97` and 2,660,897 bytes. Its earlier transport hold can now be resolved without guessing what the PDF says.

## Current source inventory

| Report year | Indexed original/amended version refs |
| --- | ---: |
| 2021 | 121 |
| 2022 | 346 |
| 2023 | 110 |
| 2024 | 123 |
| 2025 | 130 |
| **All 95 actual-serving senators** | **830** |

The **830 exact indexed refs consist of 506 originals and 324 amendments**. Of those, **590** have actual official government PDF source bytes and SHA metadata; **579 distinct whole PDF binaries** (the other **11 version refs share a PDF body**), while **240 remain official indexed references not yet downloaded**. No known indexed report is entirely absent due to a failed PDF fetch; the previously held Newton original is now obtained. Twenty-five years? No: this is strictly the 2021–25 five-report-year period.

The [110-row new PDF byte source proof](source-proof/cfb-2021-25-110-new-government-PDF-source-retrieval-v40.psv), [original independent source run checkpoint](source-proof/cfb-2021-25-110-government-PDF-source-recovery-checkpoint-v40.json), [830-row inclusive official source ledger](source-proof/cfb-2021-25-95-senators-830-indexed-590-downloaded-v40.psv) and [95-senator profile-ready source data](../../data/cfb-senate-official-filings-2021-25-v40.json) are now retained independently of the immutable preacquisition V38 source files. [V40 offline pinned full-source reconstruction](../../scripts/audit-cfb-864-830-590-original-pdf-source-v40.mjs) must pass to use this new ledger.

**Still different questions:** Current public original PDF source authenticity does **not** prove the exact amended PDF was accessible before a historic Senate vote. 2025 year-end PDFs are filed and surfaced in 2026; none is certified published-by a 2025 vote cutoff. There is no independently complete **legally owed** candidate-committee original filing denominator, no complete original report financial transaction parity, and no deduction of donor relationships or vote intent. A government PDF with unreadable contents remains valid filing existence evidence; its dollar fields remain unknown until separately reviewed. No personal donor rows, raw PDF contents, production database, stored prior-cycle eligibility, forecast model or deployment changed. The research PR and parent #864 remain open.
