# Issue #864: 24 additional original Senate committee Minutes PDFs, bounded OCR sample

The [official electronic meeting census](./senate-committee-2021-25-official-meeting-census.md) established 1,592 2022–25 **indexed committee/date meeting entries**, 1,452 original electronic Minutes-PDF links, and 141 meetings without a linked original PDF. The independent [full original-PDF source audit](./senate-committee-2022-25-original-pdf-action-census.md) downloaded all 1,452 originals but extracted sufficient embedded text from just **1,245**. Exactly **207** returned the extractor's "too little extractable text"; those were **not HTTP download failures**.

The [six-file original OCR proof](https://github.com/killjoy00/votepredict/actions/runs/38068730892) from PR #882 successfully recovered OCR text from **6/6** of six different official original PDFs. Its metadata-only artifact [11676072623](https://github.com/killjoy00/votepredict/actions/runs/38068730892/artifacts/11676072623) contains original PDF SHA-256, source identity, bytes and OCR text hashes. The existing v2 parser recognized **zero named rolls in those six** and eight *candidate* contextual actions (four voice, four result-only) in the Feb 20, 2024 Labor source. **Those eight parser detections have not been manually verified as eight distinct recorded motions.** Five sources had no matching action syntax, which does not imply no votes.

## Second sample: independently pinned 24 different originals

The [source-bound 24-item manifest](./source-proof/senate-committee-24-scanned-originals-source-manifest.json) lists **only original URLs that the full PDF source audit previously marked unparseable**, deliberately excluding the six originals above. It selects meeting dates and committees across the 2022–25 calendar and includes late-session sources. This is not a representative statistical sample of every meeting or an all-207-document sweep.

| Year | New original PDFs | Focus |
| --- | ---: | --- |
| 2022 | 8 | Finance, Agriculture, Energy, Human Services, Health, Jobs, Taxes/Property |
| 2023 | 4 | Higher Education (winter–spring dates) |
| 2024 | 4 | Higher Education and another Labor hearing |
| 2025 | 8 | Higher Education, Taxes, Judiciary and Public Safety |
| **Total** | **24** | Entirely separate from the first six originals |

The fixed-scope [one-time source workflow](../../.github/workflows/senate-committee-24-scanned-originals-ocr-sample.yml) launches **four independent historical year jobs only on first merge** (8/4/4/8 PDFs). Each checks exact pinned official LRL Senate PDF URL/year/day, permits **no HTTP redirects**, enforces **8 MiB / 8 original PDF pages**, verifies original PDF signature and pdfinfo page count before rasterization, uses the existing opt-in PDF OCR worker, then runs the existing deterministic Senate rollcall/action parser. The temporary original PDF, rasterized pages, and OCR text are discarded; only hashes, committee/day, source parser counts and exact observation keys are uploaded as metadata.

**Success criteria:** Report actual source PDF OCR successes/failures and independently auditable PDF SHA, hearing day and parser action observations. Make **no claim** that a PDF with zero supported extracted actions contains no votes or that all source actions were recognized. All named YEA/NAY votes require the original's explicit member list, and count-only/voice/unanimous/result-only motions never create inferred individual votes. Committee actions are not final Senate floor bill passage stances.

## Database and official record completeness boundaries

The separate [offline source-to-DB reconciler](./senate-committee-source-to-db-reconciliation.md) can match source hashes, recorded vote keys, named member choices and context-only actions against a **separately approved private SELECT-only evidence export**. No such private database export has been approved/obtained, no historical publication-date correction has been applied, and the ROLLBACK-only correction preview from PR #879 is **not an approved production migration**.

The official 2021 Senate minutes are **print only** and 2022 printed/electronic minutes **may differ**. The 141 electronic indexed meetings without a PDF, the remaining original scanned PDFs, and parser-recognition false negatives remain distinct missingness categories. **No all-2021–25 official meetings or recorded-votes denominator can be claimed**. Keep issue #864 OPEN. No production DB queries/writes, Vercel/Neon changes, serving/model/training, scheduler, 2027 scope or public-office contact.
