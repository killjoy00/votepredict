# #864 — 2023 Senate missing-minutes original caption procedural research proof: 64/64 authenticated

**Actual one-time source run [#38110498437](https://github.com/killjoy00/votepredict/actions/runs/38110498437) SUCCESS.** After merged [implementation PR #1036](https://github.com/killjoy00/votepredict/pull/1036), the source job re-fetched every one of the **64 official 2023 dated Senate media HTML pages without linked Minutes**, verified the independently earlier authenticated original HTML SHA for each, and re-fetched **63** previously SHA-authenticated original caption payload streams from **58** hearing pages. This was real re-fetch and original payload SHA equality, not source metadata read alone.

The actual source metadata output artifact **11691608160** was independently downloaded and byte-checked: ZIP SHA256 **f280635f8eff2b5310a7aae5e2126e8c7d5360425805316ba7a7d36f9f157492**, decoded **309,180-byte** JSON SHA256 **e6de52f4260a2fb80ef86c78499d31f73cb120ef32796c9024ccb1f6ea633a7f**. Permanent [machine-readable source proof](./source-proof/senate-2023-64-original-caption-strict-cue-source-checkpoint.json) and immutable unit tests retain both run identities and all source holds. First original broad run #38103766440 still **FAILED** (62/64) and the exact two-record retry #38104325591 still **SUCCEEDED**; those facts are preserved separately.

| Source property | Actual verified result |
| --- | ---: |
| 2023 indexed hearings without linked original Minutes, with official media URLs | **64** |
| Original LRL HTML page SHA reverified | **64/64** |
| Original hearing pages with timed captions | **58** |
| Separately SHA-proven original timed caption streams | **63** |
| Source timestamp-marker occurrences (not words/votes) | **167,594** |
| Hearing pages containing at least one strict procedural cue window | **50** |
| 30-second × category **candidate review windows** | **393** |
| Source fetching, source SHA or parser failures | **0** |
| Audio-only page holds / empty-caption hold / unexamined third caption track | **5 / 1 / 1** |

The **393** provisional cue windows come from parliamentary-looking phrases in automatic caption text, grouped to avoid repeated fragments from inflating the review queue. They are not **393 votes**, and the 50 pages are not **50 distinct motions** or 50 confirmed audio/video playbacks. A caption saying “all those in favor” is never proof of a named senator's YEA or NAY; voice, aggregate, attendance, party, narrative repetition, wrong bill numbers and missing speaker cues remain non-certifying.

## Priority original hearing review queue

These are **timestamped-review density priorities** only, to decide where actual audio/official clerks' motions deserve human inspection, not factual reports of a motion or vote:

| Official hearing | Committee | Original LRL mtgid | Distinct category × 30-second **cue windows** |
| --- | --- | --- | ---: |
| 2023-03-29 | Agriculture, Broadband and Rural Development | `1047938` | 35 |
| 2023-03-15 | Agriculture, Broadband and Rural Development | `1047752` | 21 (two caption streams) |
| 2023-04-17 | Taxes | `1048041` | 17 |
| 2023-03-20 | Agriculture, Broadband and Rural Development | `1047783` | 17 |
| 2023-02-06 | Agriculture, Broadband and Rural Development | `1047206` | 16 |
| 2023-03-06 | Agriculture, Broadband and Rural Development | `1047564` | 15 |

Across 64 hearings, source cue-window counts split as **Taxes 197**, **Agriculture/Broadband/Rural Development 155**, **Education Finance 27**, **Jobs/Economic Development 14**, **Environment/Climate/Legacy 0**. These totals are within the narrow unlinked-minutes, available-caption corpus. Zero cue windows does **not** mean a meeting contained no motions. They count category × time buckets, not canonical votes.

Six caption source gaps continue: original 2023 Jan 10 Taxes `1046896` had an authenticated zero-timed-row response; five 2023 original media pages are audio-only with no recognized safe video-caption interface (`1047437,1047599,1047707,1048027,1048030`). On 2023 Apr 27 Taxes original media `1048125`, **three** caption links were present but only the first two were SHA-verified in this exact 2023 review, so the third remained on HOLD pending its separately scoped original content source probe. No one should count it as duplicated speech, an additional vote or source-unavailable without that original source result.

**Next:** retrieve and time-localize actual original hearing audio for top cue windows, identify exact bill and parliamentary action from contemporaneous official files, verify speaker attribution and explicit sides as applicable, then compare to existing historical source/event/member-vote rows under separately approved private SELECT-only reconciliation. Continue official 2021 print-only Senate minutes and 2022 print/electronic reconciliation. CFB legal owed-filer counts, campaign-website version coverage and direct named media quotations remain separate unknown statewide denominators.

This project never downloaded/stored media/audio/video full bodies, raw automatic transcripts, senator vote sides, private data, production DB, model/training/forecast/serving/scheduler, Senate floor/2027 changes or agency contacts. **Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN.**
