# #864 — archival Senate committee caption source availability: one-time follow-up to 138 HTML media records

**Scope:** official Minnesota LRL 2022–2025 electronic committee meetings **without linked original Minutes PDFs**, source-only. Do **not** interpret a searchable caption timestamp as an actual recorded motion, a verified speaker, a senator YEA/NAY, official vote universe or real audio/video playback.

## Actual prior original record proof

The original [source run #38081463362](https://github.com/killjoy00/votepredict/actions/runs/38081463362) re-fetched **138/138** exact dated official LRL \`/media/file?mtgid=\` HTML record pages, verified against the independently sourced official hearing sections. Their four year-specific archived original JSON payloads were independently downloaded and rehashed October 10 CDT / October 11 UTC:

| Year | Real record-page sources | Original artifact | Exact original JSON SHA256 | HTML audio-player element pages | HTML video-player element pages |
| --- | ---: | --- | --- | ---: | ---: |
| 2022 | 11 | 11680881578 | \`29cefe409462e52ed21251053af2c7fc3f3240d01248cecb4fb3f0312880c6e5\` | 11 | 11 |
| 2023 | 64 | 11679809828 | \`59018e20df0bb0742ec668604a117d12dddc8c0bdb156b4b2f05e0e287ca6643\` | 64 | 59 |
| 2024 | 41 | 11680254175 | \`b32b49fcb3d85184a357fead01df1319698cd8505dfa2f562fed7e55d4f00fe0\` | 41 | 41 |
| 2025 | 22 | 11680606990 | \`d4a7c3c25eb3508150b799e53049f2cb20f358b28fd0fbd2472a65ffca52dd00\` | 22 | 22 |
| **Total** | **138** | | | **138** | **133** |

The five indexed 2023 committee hearings whose original media record has audio but **no video element** are **2023-02-21 Taxes (mtgid 1047437)**, **2023-03-07 Taxes (1047599)**, **2023-03-14 Taxes (1047707)**, **2023-04-13 Environment/Climate/Legacy (1048027)**, and **2023-04-13 Taxes (1048030)**. This **does not** prove actual MP3 data or inability to recover statements; HTML is not media playback.

## Newly bounded source probe

[New one-time original workflow](../../.github/workflows/senate-committee-138-caption-surface.yml) restores the 2022–25 *original hearing-to-mtgid source references* from source run 38079233118, AND independently restores the 138 original HTML proofs from run 38081463362. The [public-only script](../../scripts/probe-senate-138-caption-surface.ts) rejects mismatched original JSON SHAs, years, meeting dates, mtgid identities and re-fetched HTML raw hashes.

For each exact allowed official record, it reads the HTML only within a 600 KB cap, discovers **actual markup carrying a \`showcaptions\` / \`data-id=...mp4\` request contract**, checks the endpoint stays on **\`www.lrl.mn.gov\`**, and requests at most two approved official **caption metadata HTML** payloads per original meeting. A per-response strict **1.5 MB** bound, no redirect following and payload SHA256/byte count apply. No media/audio/video bytes, raw transcript contents, senator quotations, names, timestamps of spoken motions, donor details or source-page HTML are committed.

A record without an explicitly safe caption request is **\`caption_request_not_available\`**, not evidence its audio does not exist. A returned HTML body with actual \`data-time\` entries is **caption-timestamp markup**, not independently verified accurate captions, AV playback, motion speaker, bill identity or an individual vote. HTTP errors, source hash drift, unsupported domains, rejected media request strings and oversize transcripts fail closed or remain visible unknowns, not zero committee votes.

**Following the actual one-time workflow:** inspect the four real artifact results including download failures and raw ZIP/JSON SHA hashes, publish permanent source-proof tests *only if real results succeed*. Move on to **actual accessible hearing content** and independently human-adjudicated, time-localized motions if sources permit. Captions on Senate video are automatically generated and explicitly susceptible to errors. The 2021 print-only record, 2022 print/electronic differences, all statewide recorded committee votes and existing private row equality remain UNKNOWN.

No recurring crawl/scheduler, office contact, production/private DB access, serving/training/model/forecast changes, member_vote ingestion, floor expansion or 2027 changes. **Keep [#864](https://github.com/killjoy00/votepredict/issues/864) OPEN.**
