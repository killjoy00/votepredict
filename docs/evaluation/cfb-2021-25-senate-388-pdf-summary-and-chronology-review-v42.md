# VotePredict #864 — V42 actual original CFB PDF financial-summary and date research

**Research checkpoint: October 15, 2026. Source-only. Not merged, not deployed.** This work is stacked as [PR #1297](https://github.com/killjoy00/votepredict/pull/1297) on [V41 PR #1296](https://github.com/killjoy00/votepredict/pull/1296). V41 independently authenticated **830 current government PDF report version references**, 813 distinct original whole-PDF bodies, on the observed 2021–2025 Minnesota Senate Campaign Finance Board indexed inventory for 95 actual serving senators. That inventory is not an independently verified census of legally owed filings. The V41 complete original/amended source PDF hashes and registration/version identity must be reproduced before any V42 content review is allowed.

## What was reviewed

The previous content statuses had **373 downloaded but unparsed** government PDF version references, **14 hard-to-read/unresolved detail versions** and **1 original 2022 year-end date conflict**. Five V42 fixed source-review batches read all **388**, using original current CFB PDF links and re-verifying exact V41 SHA256+byte length. No source identity changed:

| PDF report year | Version references reviewed |
| --- | ---: |
| 2021 | 24 |
| 2022 | 143 |
| 2023 | 59 |
| 2024 | 60 |
| 2025 | 102 |
| **Total** | **388** |

Run [#38755685024](https://github.com/killjoy00/votepredict/actions/runs/38755685024) reviewed the 15 difficult/date sources with Poppler text extraction and narrowly scoped, *uncertified* scanned-first-page OCR. Run [#38756109428](https://github.com/killjoy00/votepredict/actions/runs/38756109428) reviewed the other 373 government PDF versions in four disjoint, checked cohorts of 95/95/95/88. All government PDF downloads were SHA-matched against V41. This is a **2026 copy examination**, not evidence of the exact report copy historically public before a 2021–25 vote.

## Report-level receipt summary results (what IS proven)

- **381/388** have extractable selectable digital PDF text. **Six** yield only provisional first-page OCR text and **one** has no usable selectable text under the initial 6-page parser.
- **379/388** have an original government PDF **Committee Transaction Summary** with a single directly co-resident printed *Total Receipts* line whose **cash + in-kind equals the displayed total**, with the amount stored as integer cents. This is report-level source arithmetic from the current PDF, *not* an independent transaction ledger match.
- **Nine** do **not** have certifiable aggregate receipts using this method. They are **NOT missing filings**; their whole original government PDF SHA and byte sizes are valid. Eight had no matched summary label, one had no extractable text.
- No report-level disbursement, loans/debt or ending-cash numbers are independently certified by this step. There is no individual donor/payee or transaction-row reconciliation or historical first-public-date promotion.

The [388-row source reconciliation](source-proof/cfb-2021-25-388-report-level-summary-and-date-review-v42.psv) identifies exact report version, full original PDF SHA+byte count, text/OCR status, source form date clues, and only certified report-level receipt totals; no raw PDF, donor, employee, vendor or detailed transaction rows. The [V42 immutable source checkpoint](source-proof/cfb-2021-25-388-content-review-checkpoint-v42.json) pins five complete Actions source jobs, source verification results and unresolved cases. The [independent offline V42 auditor](../../scripts/audit-cfb-864-388-report-content-and-dates-v42.mjs) reconstructs **all 388 exact-version source rows** against V41 and rejects uncertified amounts, changed original-PDF SHA, bad candidate identity and invented historical dates.

## Original-to-official-latest receipt summary version differences

The full 830-version index groups report families by **committee registration + report year + report period + special-election channel** and compares original version index 0 to the **last currently indexed amendment**. **92** families had source-verified *Total Receipts* values at both endpoints, of which **39 differ** and **53 are the same**. Intermediate amendments are not summed; same-PDF version aliases are not counted as newly separate contributions. All 92 report-family cents and SHA pointers are in the [92-row original/latest difference source proof](source-proof/cfb-2021-25-92-original-to-official-latest-receipts-comparisons-v42.psv).

Examples (printed report-level values, *not* incremental contributions or evidence of motive):

| Registered Senate candidate | Report | Original total receipts | Latest indexed total receipts | Difference |
| --- | --- | ---: | ---: | ---: |
| Omar Fateh | 2022 pre-general | $23,296.00 | $39,737.50 | +$16,441.50 |
| Foung Hawj | 2024 year-end | $3,000.00 | $11,695.00 | +$8,695.00 |
| Justin D. Eichorn | 2021 year-end | $14,730.00 | $21,030.00 | +$6,300.00 |
| Kari Dziedzic | 2023 year-end | $41,825.00 | $48,033.14 | +$6,208.14 |
| Zaynab Mohamed | 2025 year-end | $23,765.00 | $29,490.00 | +$5,725.00 |

Amendment difference is the change in the *printed* aggregate total for the same report family, not a new donation or a special influence event. Current 2025 YE PDF content cannot be used retroactively in a 2025 historical prediction.

## Five original printed receipt/period chronology anomalies

A further V42 source observation found four **additional** printed Board receipt dates before the report's stated covered-period end, alongside the previously held Bill Ingebrigtsen 2022 original. All five are directly visible to the strict source extractor; none is silently "corrected" and none establishes the exact historic version's first public timestamp:

| Exact official report | Printed Board receipt | Printed period ends | Review status |
| --- | --- | --- | --- |
| Bill G. Ingebrigtsen, 2022 YE original | Sep 17, 2022 | Dec 31, 2022 | Previously held; still inconsistent |
| Paul E. Gazelka, 2021 YE original | Sep 26, 2021 | Dec 31, 2021 | Newly flagged |
| Melisa López Franzen, 2022 YE original | Nov 5, 2022 | Dec 31, 2022 | Newly flagged |
| Andrew R. Lang, 2023 YE original | Dec 29, 2023 | Dec 31, 2023 | Newly flagged |
| Bruce Douglas Anderson, 2025 YE original | Oct 9, 2025 | Dec 31, 2025 | Newly flagged |

These are **source-date interpretation holds**, not findings of invalid legal filings, deliberate misreporting or proof of source content public before period-end. Determine whether a form field, print artifact, reposting/redaction, or other source-date mechanism explains the discrepancy before assigning a corrected timestamp. No historically eligible features were recalculated.

## Second look at the nine remaining content holds

[Independent bounded secondary-source run #38758588098](https://github.com/killjoy00/votepredict/actions/runs/38758588098) verified the **same nine original PDF SHA256 bodies**, expanded digital text extraction through up to twelve pages, and used additional first-two-page OCR **only where a digital text layer was absent**. Results:

- **Seven full-image/scanned PDFs**: two Thomas M. Bakk year-ends, Jason Isaacson's 2021 and 2022 original-plus-amendment (three versions), Omar Fateh's 2021 amendment and Jerry Newton's 2021 original. OCR supplies possible form cues, but **no certified receipt amounts or dates**.
- **Two short, digitally readable amended PDFs**: Aric Putnam's 2021 and Zaynab Mohamed's 2021 amendments. Expanded text extraction still did not locate an authentic Committee Transaction Summary total-receipts row.
- **Zero new certified report receipt totals**. All nine remain original official indexed-source filing evidence with qualified unknown monetary summaries; they must not be represented as absent filings.

[Original nine-case source PSV](source-proof/cfb-2021-25-nine-still-unverified-summary-secondary-gov-source-v42.psv), [secondary source checkpoint](source-proof/cfb-2021-25-nine-unresolved-PDF-review-checkpoint-v42.json), and [standalone nine-case offline audit](../../scripts/audit-cfb-864-nine-original-report-holds-v42.mjs) preserve the original source counts without reporting raw OCR text, personal names outside registered senator identities, or unverified dollars.

## Remaining manual work and explicit limits

1. **Nine selected reports:** Independently inspect government first/summary-page images and distinguish scanned full forms from supplementary amendment pages. Consider Board-published alternative copies or report-level certified summary exports. OCR numbers remain provisional until independently verified against a clear original form layout and arithmetic. Do not repeat identical OCR approaches indefinitely.
2. **Five chronology holds:** Validate precise **form field semantics** from report originals and independent Board calendar/archived source before even considering revising any claimed receipt date. Never replace the original observed value based merely on chronological plausibility.
3. **Financial proof scope:** Independently verify official aggregate expenditures, loan/debt balances and transactions, while ensuring amendments remain version updates rather than new receipts. The statutory owed-original denominator remains unknown.
4. **Historical cutoff:** No current CFB PDF acquisition or legal ordinary-report non-publicity floor establishes when the exact version was actually made public before a historical Senate vote. **0 exact publication dates independently established.** Keep historical prediction eligibility unchanged.

No raw PDFs, screenshots, OCR transcript, donor-level personal data, vendors, monetary transaction rows, Neon/protected production reads or writes, model changes, live forecast changes, migrations, deployments, scheduled tasks or outreach. Source research is review-only. Keep parent issue **#864 OPEN**.
