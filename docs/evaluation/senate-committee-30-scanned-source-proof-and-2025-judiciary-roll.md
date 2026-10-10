# Issue #864 — 30 original scanned Senate minutes OCR source proofs, and one named-roll follow-up

## Measured official source record

The first exhaustive **electronic-original-PDF acquisition** [run #38066441841](https://github.com/killjoy00/votepredict/actions/runs/38066441841) downloaded all 1,452 original Minnesota Legislative Reference Library Senate Minutes links for 2022–25. Exactly 1,245 PDFs gave enough embedded text for the current v2 Senate recorded-rollcall/action parser; 207 original PDF files were downloaded but had too little extractable text. This did **not** imply that these 207 lacked recorded actions.

The first six-source OCR [run #38068730892](https://github.com/killjoy00/votepredict/actions/runs/38068730892) recovered **6/6** scanned originals. The larger independent **24-other-original** [run #38069432305](https://github.com/killjoy00/votepredict/actions/runs/38069432305) recovered **24/24**, all under an 8 MiB and 8-page per-original cap. **30 distinct original PDFs** now have new OCR metadata proofs; the **remaining 177 of the original 207** have **not** been separately OCR recovered. These 30 do not prove the parser recognized all actual actions inside each source.

| Cohort | OCR recovered | Parser named roll calls | Named source choice entries | Context-only parser action candidates |
| --- | ---: | ---: | ---: | ---: |
| First six originals | 6 | 0 | 0 | 8 |
| 2022 added originals | 8 | 0 | 0 | 19 |
| 2023 added originals | 4 | 0 | 0 | 2 |
| 2024 added originals | 4 | 0 | 0 | 17 |
| 2025 added originals | 8 | 1 | 8 | 16 |
| **Total** | **30** | **1** | **8** | **62** |

The candidate actions are parsed from original OCR text, not human-confirmed distinct motions. Count-only, voice, unanimous and result-only actions are **context**, never synthetic named senator YEA/NAY. No inferred final floor bill-passage positions or member vote outcomes are created.

A [durable metadata-only original source ledger](./source-proof/senate-committee-30-scanned-ocr-source-ledger.json) preserves every original Actions artifact ID, original ZIP SHA-256 and decoded JSON SHA-256, year totals, original source identity of the named-roll lead, and every still-open limitation. Original PDF bytes, OCR text, page image and human name lists are **not** stored in the ledger.

## Specific newly recoverable named roll — March 12, 2025

One [official original Senate Judiciary and Public Safety minutes PDF](https://www.lrl.mn.gov/archive/minutes/senate/2025/jud/20250312/Jud_20250312_minutes.pdf) had no sufficient embedded text in the initial audit. The independently captured 2025 OCR [source artifact 11675584270](https://github.com/killjoy00/votepredict/actions/runs/38069432305/artifacts/11675584270) reports:
- actual hearing date **2025-03-12**, original document exactly under official Senate Judiciary LRL URL;
- original PDF raw SHA-256 **0f272639ecf612217daa230794df31731428bbc665e6a2caa6dad26442c54f0a**, 874,494 bytes;
- OCR text SHA-256 **609bf8f2e212c88eb3e6a414d2eb352258486b24664b885eb92ee45a0be69728**, 3,168 text bytes;
- parser v2 one **named** eight-choice rollcall candidate with original durable vote_event external key **senate-committee:3f52889e20a9b8a6:0** and two separate context-only action candidates.

The distinct one-time [original named-roll proof workflow](../../.github/workflows/senate-committee-2025-judiciary-original-named-roll-proof.yml) reacquires **only that exact original** (no redirects, max 8 MiB, max 8 pages), verifies the raw PDF **and** OCR text SHA-256 against the earlier source run, and **fail-closes** if exact source day/committee, named tally, eight named-choice one-way hashes or parser motion yield changes. It emits the original eight normalized-source-name+choice **hashes, not names**, along with explicit yea/nay count and the exact existing vote-event key. This is sufficient metadata for *future* source-to-DB comparison via the existing [offline reconciler](./senate-committee-source-to-db-reconciliation.md), but **not proof that such a member vote exists in the private DB**.

A contemporaneous committee action's event date is the actual hearing day under the accepted historical committee timing rule, not evidence of intraday public release of its current PDF. Same-day cutoff remains excluded. Do not infer final Senate passage stance from the committee motion.

## Still not completed

1. Exact original full 2021 Senate **print-only** committee minutes and official meeting/vote denominator.
2. Independent reconciliation of 2022 printed minutes versus the electronic collection, plus 141 indexed 2022–25 meetings with no Minutes-PDF link.
3. Extraction/manual verification of all recorded action semantics, including the 177 original scanned PDFs not yet OCR recovered and 141 embedded-text PDFs with unmatched roll-call phrase signals.
4. **Separately authorized** read-only export of private historical evidence source_documents, vote_events, member_votes and evidence_items, followed by exact source PDF hash/roll counts/member attribution/context row reconciliation.
5. Separate operator-approved, reviewed historical hearing-date repair, since [PR #879](https://github.com/killjoy00/votepredict/pull/879) provides only a **ROLLBACK-only SQL preview** and future duplicate-protection.

No production DB was read or written by these source proof jobs; no evidence inserted, no model/training, serving, schedule, 2027 or outside public-office contact. **Issue #864 stays OPEN.**
