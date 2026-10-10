# Issue #864 — Original 2022–2025 Senate committee minutes action census

**Scope:** electronic 2022–2025 official Minnesota Legislative Reference Library Senate committee Minutes PDFs only. 2021 official Senate minutes are print-only; the 2022 print and electronic collections may differ. No private DB, forecasts, schedulers, floor work, public-office contact or 2027 work.

The [PR #878 official meeting-link audit](./senate-committee-2021-25-official-meeting-census.md) fetched **all 99 publicly listed committee index pages** in 2022–2025 and found **1,592 distinct committee/date meeting entries**. **1,451** had an official Minutes PDF link; **141** did not. One 2023 meeting had two linked original Minutes PDFs, producing **1,452 distinct original PDF links**:

| Year | Listed meetings | With Minutes PDF | Without Minutes PDF | Original PDFs |
| --- | ---: | ---: | ---: | ---: |
| 2021 | unknown (print only) | unknown | unknown | unknown |
| 2022 | 337 | 325 | 12 | 325 |
| 2023 | 517 | 453 | 64 | 454 |
| 2024 | 300 | 258 | 42 | 258 |
| 2025 | 438 | 415 | 23 | 415 |
| Total 2022–2025 | 1592 | 1451 | 141 | 1452 |

The [official source audit #38065594898](https://github.com/killjoy00/votepredict/actions/runs/38065594898) had zero page-download failures or inventory anomalies. These source-index totals do not constitute a full historical *recorded vote* denominator or a database completeness certificate.

## Source-bound action census

A [one-time four-way source workflow](../../.github/workflows/senate-committee-2022-25-original-pdf-action-audit.yml) runs fixed historical per-year PDF jobs. Each re-enumerates the official LRL index and fetches up to 650 original Minutes PDFs per year with no more than two concurrent original PDF source fetches per job. The original bytes are SHA-256 hashed and its embedded text parsed **in memory** with the existing reviewed Senate roll-call/action parser. PDF bodies and extracted text are NOT persisted or uploaded.

Each original-document metadata record retains verified source URL, committee, hearing day, original PDF raw byte length and SHA-256, extracted-text SHA-256, extraction method, plus candidate roll-call and action observations. Named YEA/NAY votes require explicitly named choices; count-only divisions are contextual with **no member vote inference**; voice/unanimous/result-only actions remain context; committee amendments/motions are **not** final chamber passage stances. Exact source/observation external-key fingerprints support later database reconciliation without recording raw motion text or names.

A source cue for unparsed roll calls/voice votes and zero-detected-action flag surfaces parser missingness rather than assuming an unparsed document has no votes. Missing PDF access or text extraction is a separate documented source failure, not zero actions. Source parser yield is a **candidate observation count, not a certified official all-actions denominator**. The 2021 print and 2022 mixed-record boundaries also remain open.

## Distinct private DB reconciliation/correction

Reconciliation of original PDF vote-event external keys, counts, named-member choices and context actions to persisted source documents and evidence requires a separately authorized SELECT-only database export, which this source census does not access. The [review-only hearing date correction planner](./senate-committee-legacy-hearing-evidence-repair.md) emits a strict ROLLBACK-only SQL preview, not an approved production mutation. Date-only same-day forecast cutoffs are always excluded. Issue #864 remains OPEN.
