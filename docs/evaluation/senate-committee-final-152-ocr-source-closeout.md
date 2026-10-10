# Issue #864 — independent nine-batch original-source proof closeout of all 152 remaining scanned Senate minutes

On 2026-10-10, PR [#888](https://github.com/killjoy00/votepredict/pull/888) merged a **source-only, immutable original-audit SHA-bounded** OCR run for 110 previously unreadable 2022 Senate committee minutes and 42 previously unreadable 2025 minutes. Source [run #38075234242](https://github.com/killjoy00/votepredict/actions/runs/38075234242) completed successfully in **all nine independent batches, 152/152 originals OCR recovered, no acquisition or OCR failures**. Premerge [CI #38075059670](https://github.com/killjoy00/votepredict/actions/runs/38075059670) and postmerge [CI #38075234237](https://github.com/killjoy00/votepredict/actions/runs/38075234237) passed on the exact PR/main commits.

The fixed source selection is derived solely from original 2022/2025 full-PDF-audit artifacts in [run #38066441841](https://github.com/killjoy00/votepredict/actions/runs/38066441841), whose original decoded JSON hashes and exact source URL lists are strictly verified. The older independent OCR recoveries (6 + 24 + 25 = 55) are subtracted by exact URLs. Nine shards process only the resulting 152 official original PDFs. Every original gets an 8 MiB stream limit, 8-page preflight, official-site no-redirect policy and exact hearing date/path check. The source scripts emit original PDF raw SHA-256 and OCR text SHA-256, parser observations and exact vote key/individual choice hashes; PDFs, raster images, OCR text, and source names are not committed.

## Independent original source proof

All nine downloaded source artifact ZIP SHA-256 and decoded JSON SHA-256 digests, original run IDs, original source SHA pins, year/batch counts, *nine* distinct original source URLs with parser named-roll candidates and their PDF/OCR hashes are stored in [durable original source ledger](./source-proof/senate-committee-final-152-ocr-source-ledger.json) with immutable regression tests. The complete 152-original per-source metadata export is separately hash-bound by SHA-256 `c300d4c1a9443193200cd1c830a9993edc0f0919c2147996564b43f218c2cfa9`; only source metadata and hashes, never full text or member names. Its per-source JSON needs separate archival if Actions artifact expiration could make it unavailable.

| Year | Newly OCR-recovered original PDFs | Parser named-roll candidates | Explicit named-choice tokens | Count-only roll candidates | Parser context-only action candidates |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2022 | 110 | 11 | 99 | 3 | 200 |
| 2025 | 42 | 3 | 27 | 0 | 30 |
| **Total** | **152** | **14** | **126** | **3** | **230** |

Across earlier OCR cohorts, another one 2025 Judiciary parser named-roll candidate yielded 8 explicitly named YEA/NAY choices, and 94 additional contextual parser action candidates. Therefore the 207 originally unreadable but now OCR-extractable *electronic original* PDFs contain **15 parser named-roll candidates with 134 named choice tokens and 324 parser context-only action candidates**. These are parser observations from OCR, **not** a human-verified count of distinct recorded motions/votes and **not** evidence of a model improvement.

The known original 2022–25 electronic PDF links are now technically extractable: **1,245** originally embedded-readable originals + **207** OCR-recovered originals = **1,452/1,452 indexed PDF links source text readable**. One 2023 meeting has two original PDFs. However this measures source extraction, *not* every official meeting, not every recorded action in a document and not historical private DB coverage.

## Unresolved source-to-database and official denominator work

- **141 official electronically indexed 2022–25 meetings without linked Minutes PDFs.** Alternate official agenda/media document candidates need exact hearing attribution and original-page verification. A page containing a universal site-menu 'video' link does not establish a recording for a particular hearing.
- **141 embedded-text original PDFs with a roll-call phrase but no supported vote parser observations**, plus four of the newly OCR-recovered PDFs with potential remaining unparsed-roll signal. Phrases may mean attendance roll or another nonvote context; no automatic member votes.
- **2021 Senate original Minutes are print only**; the official all-meeting/all-recorded-vote denominator is unknown. **2022 printed vs electronic collections may differ** and need independent reconciliation.
- **Private historical evidence DB source-to-rows comparison and hearing-date correction have NOT been performed.** Already merged repair preview is ROLLBACK-only and awaiting separate owner authorization for private read-only export and any production corrections.
- No individual outcome may be inferred from count-only, voice, unanimous, attendance or motion result; committee motion is not a Senate chamber final passage position. Historical hearing date is the accepted action date, with same-day model cutoff still excluded.

No production database access/writes, training, model, forecast, serving, scheduler or 2027 changes, no outside office contact. Keep #864 OPEN until the official complete source denominator and exact private-record reconciliation are independently supported.
