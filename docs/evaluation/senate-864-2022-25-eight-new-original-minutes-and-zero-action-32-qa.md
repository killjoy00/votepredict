# #864 — 2022–2025 Senate committee original-minute recovery and 32-document parser audit

**Research checkpoint:** October 14–15, 2026. **2021 intentionally excluded.** This is an additive written-government-source checkpoint, not certification of all recorded motions or stored member votes.

## Source recovery: +4 indexed hearing days, +8 government original PDFs

The original Legislative Reference Library 2022–2025 indexed meeting universe has **1,592** unique committee/date identities. The prior independent written-Minutes source ledger established **1,563** of those 1,592 hearing dates (1,451 linked-PDF dates, 111 Clerk HTML alternate dates and 1 unlinked official 2022 Housing Minutes PDF), leaving 29. The legacy PDF discovery accepted only URLs with exactly `/YYYYMMDD/` directories and filenames ending `_Minutes.pdf`. The official LRL archive actually contains additional same-committee, printed original Minutes with morning/evening directories and nonstandard filenames. These originals had been missed even when the LRL committee-year page linked them publicly.

A [successful independent original PDF acquisition](https://github.com/killjoy00/votepredict/actions/runs/38680515336), immutable [uploaded source audit artifact #11948425264](https://github.com/killjoy00/votepredict/actions/runs/38680515336/artifacts/11948425264), ZIP SHA `1e4fa7a20643e3b10d750cf991935a62af70956e03d63de18a4ba545362ca893`, located and re-downloaded **eight original government PDF byte bodies** across **four** hitherto unverified indexed meetings. Every PDF matched an exact official committee/date and formal printed Senate Minutes source, and all original byte SHA-256 values were recorded permanently in [the 8-PDF SHA receipt](./source-proof/senate-864-2022-25-eight-alternate-lrl-original-pdf-sha-receipts.json).

| Year | Committee and indexed day | Original PDF bodies | Named roll candidates | Contextual parser observations across PDFs |
| --- | --- | ---: | ---: | ---: |
| 2022 | Education Finance and Policy — Apr 4 | 2 afternoon Minutes PDFs | 0 | 0 |
| 2023 | Education Finance — Feb 16 | morning and evening Minutes | 0 | 4 |
| 2023 | Education Finance — Mar 15 | morning and evening Minutes | 0 | 4 |
| 2023 | Jobs and Economic Development — Mar 20 | Minutes-(1) and Minutes-(2) | 0 | 6 |
| **Newly recovered** | **four meeting dates** | **eight original PDFs** | **0** | **14 non-deduplicated parser observations** |

The reported **14 are parser occurrences across eight PDF bodies**, not a separately certified count of distinct parliamentary actions; original morning/evening sessions and repeated text must be associated with precise motion anchors to deduplicate. None supplies source-printed named YEA/NAY vote choices. Examples with independently verified originals:

- [Feb 16, 2023 Education Finance evening original](https://www.lrl.mn.gov/archive/minutes/senate/2023/fineduc/20230216evening/fineduc_20230216_Minutes.pdf) and [morning original](https://www.lrl.mn.gov/archive/minutes/senate/2023/fineduc/20230216morning/fineduc_20230216_Minutes.pdf).
- [Mar 15, 2023 Education Finance evening original](https://www.lrl.mn.gov/archive/minutes/senate/2023/fineduc/20230315evening/fineduc_20230315_Minutes-evening.pdf) records four result-only actions involving SF2399, SF2147, SF1415 and SF2722, and [morning original](https://www.lrl.mn.gov/archive/minutes/senate/2023/fineduc/20230315morning/fineduc_20230315_Minutes-morning.pdf).
- [2022 Apr 4 Education Finance afternoon original #1](https://www.lrl.mn.gov/archive/minutes/senate/2022/Fineduc/20220404/fineduc_20220404_minutes_pm1.pdf) and [#2](https://www.lrl.mn.gov/archive/minutes/senate/2022/Fineduc/20220404/fineduc_20220404_minutes_pm2.pdf).
- [2023 Mar 20 Jobs original #1](https://www.lrl.mn.gov/archive/minutes/senate/2023/jobs/20230320/Jobs_20230320_Minutes-(1).pdf) and [#2](https://www.lrl.mn.gov/archive/minutes/senate/2023/jobs/20230320/Jobs_20230320_Minutes-(2).pdf).

**Revised government indexed written-minute source coverage: 1,567 / 1,592 = 98.4%. Remaining 25 indexed written-minute gaps.** The original 141-row, 29-source-hold ledger remains a *valid prior checkpoint*, not retroactively mutated. The new additive 8-PDF receipt overlays those four original source holds when building the combined action inventory. The source coverage and missingness by year after the overlay are:

| Year | Official indexed meetings | Original written Minutes now authenticated | Still no authenticated written Minutes |
| --- | ---: | ---: | ---: |
| 2022 | 337 | 334 | 3 |
| 2023 | 517 | 514 | 3 |
| 2024 | 300 | 286 | 14 |
| 2025 | 438 | 433 | 5 |
| **Total** | **1,592** | **1,567** | **25** |

The current **25** holds are 2022 Housing March 15 and Environment/Natural Resources August 10 and October 3; 2023 Environment/Climate April 13 and Taxes April 27 and May 12; the same 14 2024 holds (including 11 Taxes); and the same five 2025 holds (including four Energy). A negative link or transport check does **not** prove that no committee meeting, no official written minutes, no motion or no vote occurred. The 2022 print/electronic parity remains unknown. No independent original publication datetime is claimed: under owner’s historical convention `occurredOn` and `availableOn` are the public hearing date, with **same-day forecasts excluded**.

## Parser recall QA: 32 independently reauthenticated originals among 568 first-pass zero-action meetings

The original baseline electronic PDFs contained **568 indexed meeting dates** with no parser-v2 recorded or contextual action candidate (**197 originally OCR-recovered, 371 embedded-text**). This is a parser-zero-action population, *not* 568 missing votes. The [32-original-pdf recall workflow](https://github.com/killjoy00/votepredict/actions/runs/38680095705) re-fetched four original OCR and four original embedded-text PDFs from each of 2022, 2023, 2024, and 2025, compared every actual original PDF byte SHA against immutable source hashes, and re-ran current parsers and bounded text cues. **All 32 reauthenticated, zero held; 11 flagged for further motion-level review.**

| Year | Source-original PDFs authenticated | PDFs with explicit motion or roll cues, or newer parsed actions warranting review |
| --- | ---: | ---: |
| 2022 | 8 | 2 |
| 2023 | 8 | 3 |
| 2024 | 8 | 5 |
| 2025 | 8 | 1 |
| **Total** | **32** | **11** |

Flagged dates/committees include:
- 2022 Feb 28 Health & Human Services Finance and Policy; Mar 23 Agriculture and Rural Development Finance and Policy
- 2023 Jan 24 Rules & Administration; Feb 7 and Mar 30 Higher Education
- 2024 Feb 20/Mar 26 Labor; Mar 7/Apr 18 Higher Education; Mar 19 Environment, Climate, and Legacy
- 2025 Feb 6 Housing and Homelessness Prevention

The latest parser recognized some context-only action candidates (e.g. Labor and Higher Education), but the original source also shows explicit printed MOTION results for documents with *zero frozen action candidates*, including some still missed by the current contextual parser. Conversely a separate original [January 8, 2025 Finance Committee](https://www.lrl.mn.gov/archive/minutes/senate/2025/fin/20250108/Fin_20250108_Minutes.pdf) documents an informational hearing without a recorded vote, showing why parser-zero must not be auto-treated as a missing vote.

**Next work after this independently verified source checkpoint:** follow up those 11 with motion-by-motion original printed lines, then expand the high-yield check across the remaining zero-action originals; test voice/result-only and amendment boundaries without inferring individual choices. Separately reconcile the 139 named source-roll candidate observations (112 newer indexed PDF parser candidates plus 27 Clerk original candidates) to **actual** stored motion keys, source SHA and historical membership; no source-roll candidate count proves absent production `member_votes`. Historic positional-key `ON CONFLICT DO UPDATE` replay remains expressly disallowed.

**Database and deployment:** No production writes, no app deployment, no model retraining/scheduler actions, no historical member-side guesses. VotePredict original-source protected Neon row parity remains to be certified on the correct project's approved database branch. [Issue #864](https://github.com/killjoy00/votepredict/issues/864) stays open.
