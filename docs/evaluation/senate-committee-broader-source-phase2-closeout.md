# Issue #864 — broader Senate historical committee source findings, October 10, 2026

This **source-only** phase extends the fully recovered 1,452 indexed electronic 2022–25 Senate committee minutes PDF originals. It addresses parser omissions, checks 15 previously identified OCR named roll-call candidates, and resolves missing-minutes alternate-source links. The repository has **not read, updated or repaired** the historical private evidence database, serving, model, predictions, schedulers or 2027 program.

## Independent results

| Audited source gap | Source-only result | Not established |
| --- | --- | --- |
| 41 highest-priority embedded-text PDFs with roll-call phrase + YEA/NAY label and no prior parser supported roll | **41/41 original bytes and text hash reverified; 0 failures** in one-time source run #38078641464 (#896) | Number of true distinct recorded motions, correct identities/choices |
| 10 previously low-text, OCR-recovered original PDFs giving named roll candidates | **15/15 candidate rolls and 134 original named-choice tokens reproduced; 0 mechanical YEA/NAY/name integrity violations** in run #38079052118 (#898) | Official senator membership, motion identity and database-row equality |
| 141 official electronically indexed meetings with no linked Minutes PDF | **138 unique hearing-date-section official LRL media-file record IDs** `/media/file?mtgid=...`, three without a link, in run #38079233118 (#897) | 138 verified playable recordings, minutes recovered, spoken votes |
| The 138 individual official media IDs | **138/138 HTTP HEAD responses, all HTTP 200 `text/html`, zero errors** in run #38079795850 (#900) | Video/audio successfully plays, any transcript, speaker or named vote |
| Separate, non-serving named-choice parser on the same 41 strongest PDF originals | **86 provisional blocks, 823 named-choice tokens; 19 exact named/numeric tally matches (196 tokens), 10 tally mismatches, 57 without recognized independent tally**, in successful rerun #38079646647 (#899/#901) | That 86 blocks are real distinct votes, or 823 entries are unique actual member choices |

The 19 highest-priority *provisional* motion/vote source-offset identities are permanently recorded in [tally-matched review queue](./source-proof/senate-committee-19-tally-matched-provisional-roll-review-queue.json). One is 2023 Judiciary and Public Safety, three are 2024 Health and Human Services or Labor, and fifteen are 2025 Elections. Some are multiple actions in the same hearing; **a matching 5/6 or 6/5 tally does not prove unique motions**. Names and original text are not committed, and no candidate is eligible as an individual member vote without per-motion semantic verification, official senator roster attribution, and approved database reconciliation. Ten mismatches are specifically excluded from any high-confidence vote claim; the remaining 57 lack supporting numeric totals. The parser is *not* added to production serving or evidence ingestion.

## Permanent source proof and next step

The original one-time metadata archives' exact artifact IDs and ZIP/JSON SHA-256s for all 41 roll source originals, the 15 OCR named candidates, all 138 individually linked official LRL media IDs, their HTTP HEAD result files, and the supplemental 86 candidate blocks are pinned with immutable tests:
- [original 41 & OCR 15 source ledger](./source-proof/senate-committee-phase2-41-15-original-source-ledger.json)
- [138 media identifiers, HEAD-only results and 86 provisional candidate ledger](./source-proof/senate-committee-phase2-media-and-supplemental-ledger.json)
- [19 exact source-offset provisional candidate review targets](./source-proof/senate-committee-19-tally-matched-provisional-roll-review-queue.json)

Priority work remaining: manually validate the 19 matched-tally and 15 OCR named source candidates against exact motion paragraphs and contemporaneous Senate committee rosters; inspect actual 138 archive record pages for usable recording playback/transcripts, then separately verify any spoken votes; review all 141 older embedded-text possible omitted roll signals and four additional OCR flags; acquire 2021 official printed Senate committee records and independently reconcile 2022 printed versus electronic collection. Finally, compare original official source keys and named choices with a **separately authorized read-only export** of persisted private historical evidence; review/apply corrected rows only after independent authorization. No inference of individual choices from attendance, aggregate numbers, voice/unanimous motions or majority outcomes. Hearing date remains event/public-by; same-day eligibility is excluded. These are Senate *committee* actions, not Senate floor final votes.

The official denominator for all 2021–25 committee meetings and actual recorded votes remains unknown. **Keep issue #864 OPEN.**

**Playback qualification:** All 138 official media-record URLs returned an HTTP 200 HEAD response with a `text/html` content type. This proves the associated archive *record pages* respond; it does not establish an available audio/video stream, content playback or a named recorded vote. A future per-record playback/transcript audit must separately validate actual source media before vote reconstruction.
