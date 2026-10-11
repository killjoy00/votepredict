# #864 — 2025 strict original caption procedural cues: actual 22/22 source proof and fail-closed summary correction

The [actual one-time source run #38109398816](https://github.com/killjoy00/votepredict/actions/runs/38109398816), on merged [strict visible-HTML v2 parser PR #1019](https://github.com/killjoy00/votepredict/pull/1019), ended **SUCCESS**. All **22/22** original 2025 Minnesota Senate hearing media pages and caption HTML bodies were independently matched against their previously authenticated original source SHA-256/byte counts. Zero original HTML/caption acquisition failures. Output is a procedural *research cue index*, not committee recorded votes.

## Independently downloaded original source artifact

Artifact **11691027647**, name `senate-2025-22-original-caption-strict-procedural-cues-v2`, was downloaded directly from the actual successful run. Independently rehashed exact ZIP SHA256 **`8d50cfc1707b15c9e78d532c62f134f24471d30e7c32e1fd23005b013da91c07`**, ZIP **13,728 bytes**; uncompressed original JSON SHA256 **`f1e3af71d2ed4543d3a587791ce9f54e92547faef81242618cada7cda06aef4c`**, **98,340 bytes**. These exact identities and all bounded results are locked permanently in [metadata-only proof](./source-proof/senate-2025-22-strict-caption-original-cue-source-checkpoint.json) and [immutable test](../../tests/senate-2025-strict-caption-original-cue-summary-proof.test.ts). The original HTML, media and full captions are NOT stored in Git.

## Real source outcomes

| Original bounded source measure | Reverified |
| --- | ---: |
| Official 2025 unlinked-Minutes meeting media records with caption body SHA | 22 / 22 |
| Original source failures | 0 |
| Timestamp markers in verified original HTML bodies | 47,306 |
| Hearings with **at least one** strict procedural regex cue | 18 / 22 |
| Independently reconstructed category/time review windows | **160** |
| Cue windows preserved in exact artifact | 160 |
| Cue windows omitted by packet cap | 0 |

The complete strict category/window classification from original **individual source records** is: **11 committee recommendation**, **24 formal-motion introduction**, **68 voice-language**, **29 explicit-roll request**, **28 formal-motion result** = **160**, *not* 160 distinct committee motions or member votes. The four hearings with no matched strict cue are **2025-01-22**, **2025-02-17**, **2025-03-03**, **2025-03-10**, all in Energy/Utilities/Environment/Climate: a lack of a regex cue is NOT a finding that those hearings had no action or vote.

## Actual source output defect and corrected downstream invariant

**Do not silently rewrite original immutable source output.** Its top-level `total.sourceCueWindowsTotal` is literally **`null`**, because the v2 runner still referenced the removed v1 `totalDistinctThirtySecondCategoryCueWindows` field, silently summing `NaN`; JSON serialized that number as `null`. Each of the 22 original source records has the correct **`categoryThirtySecondWindowsNotDistinctMotions`**, `sourceReviewCueTimeWindows`, and `cueWindowsAboveOutputCap` values, and their independent exact-bounded recomputation equals **160**. The source checksum and original failed summary are retained as originally observed.

The corrected [pure fail-closed cue summarizer](../../src/evidence/senate-committee-strict-caption-cue-summary.ts) demands correctly named v2 row fields, exact `saved windows + overflow = total`, integer/bounded counts and no implicit `NaN` conversion. The v2 original runner now invokes that helper for subsequent runs, but this PR does **not** re-fetch or re-label the already successfully authenticated 22 public source pages. The historical original artifact remains unchanged.

## Unresolved complete-history gates

No actual audio/video was replayed, no speaker or named individual vote was authenticated, no separately distinct motion was counted, and no last-published historical public-by or forecast eligibility was established. The 2021 print-only official Minnesota Senate minutes, 2022 print/electronic difference, broader 141 indexed hearings without linked minutes and actual statewide 2021–2025 recorded committee vote denominator all remain unknown. Senate-service-only campaign/CFB/media-quote evidence remains separate and under its own source restrictions. **No Neon/Vercel, private/production DB, model, forecasting, training, serving, scheduler, Senate floor, 2027, or government-office contact. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN.**
