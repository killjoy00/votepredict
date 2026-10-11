# #864 — exact 141 official indexed Senate meetings without linked Minutes: permanent review queue

**Scope:** public-only Minnesota Legislative Reference Library (LRL) **2022–2025 electronic committee index**. Preserved from **five actual independently downloaded, ZIP+JSON SHA-verified GitHub source artifacts** dated October 10, 2026. This is a *meeting metadata* queue, not a statewide historical meeting or vote denominator.

## Why this queue exists

The independently verified [official index source census](./source-proof/senate-2022-25-committee-original-minutes-source-ledger.json) has **1,592 indexed meetings**, **1,451 with linked Minutes**, **141 without**, and **1,452 original PDF links** because one 2023 meeting has two original PDFs. All **207 original low-embedded-text linked PDFs were already OCR-recovered** in the [final recovered 207-ledger](./source-proof/senate-committee-final-152-ocr-source-ledger.json): there is no reason to repeat that cohort's acquisition. The current block is the **141 separate indexed meetings without an original PDF link**, not OCR absence.

The [new immutable compact roster](./source-proof/senate-committee-141-unlinked-original-meeting-roster.json) reconstructs **all 141 exact original indexed meeting dates, all 20 committee-year name+ID groups, and original committee index URLs**. It was regenerated directly from SHA-verified official original index artifact **11674762938** ([run #38065594898](https://github.com/killjoy00/votepredict/actions/runs/38065594898)), ZIP SHA256 **cd39d5b334a4917616d614a03ae8b2ec0776e70214ae111ac5b54f877e890c7b**, decoded JSON SHA256 **ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0**. Original year-specific [dated source review run #38076153790](https://github.com/killjoy00/votepredict/actions/runs/38076153790) rechecked all 141 individual official dated page sections. The roster records all four actual original review artifact IDs, ZIP SHA and JSON SHA; separate tests fail closed on unexpected date, committee, uniqueness or modified blob content.

| Index year | Meetings without linked Minutes | With dated media-record lead | Without dated media lead |
| --- | ---: | ---: | ---: |
| 2022 | 12 | 11 | 1 |
| 2023 | 64 | 64 | 0 |
| 2024 | 42 | 41 | 1 |
| 2025 | 23 | 22 | 1 |
| **Total** | **141** | **138** | **3** |

**Three high-priority dated source-absence cases (NOT proven to be meeting/vote absent):**
- **2022-04-21** — Energy and Utilities Finance and Policy
- **2024-05-16** — Environment, Climate, and Legacy
- **2025-05-12** — Rules and Administration - Subcommittee on Committees

**Highest-volume unlinked sources** in the official electronic index: 2023 Taxes **37**, 2024 Taxes **23**, 2023 Agriculture/Broadband/Rural Development **22**, 2025 Energy/Utilities/Environment/Climate **17**, 2024 State and Local Government/Veterans **13**. Those five groups account for **112/141** exact indexed no-minutes meeting records. An unlinked meeting can still have a hearing recording, voice vote, written committee report or unpublished physical minutes; do not infer zero motions from the missing link.

## Next independent source reconciliation

Review the **138 media-record leads as actual recordings**, not merely HTTP-200 player pages. For each specific indexed hearing, preserve exact official media URL and original date, whether video/audio can be replayed, original speaker/time and actual motion segment where applicable; use a reviewed audio transcript with error provenance if necessary. Keep **video/caption/paraphrase/official minutes** as separate evidence types. **No YEA/NAY by party, opening attendance, count-only result, voice, pass, silence or absence.** Where the official minutes are absent, do not replace them with an inferred individual side or call a source-listing link a vote.

For the three no-media-lead cases, search additional existing public documents or non-contact public archives and mark exact **unavailable / not-yet-discovered / outside electronic record** distinctions. The 141-row roster does not assert those meetings lacked votes, that all unlisted meetings were enumerated, or that every recording is accessible. The 2021 official print-only meetings remain **UNKNOWN**; 2022 official print and electronic sets may differ, so **no statewide 2021–25 recorded vote denominator or completeness percentage** is established.

A future source-to-existing-private-row reconciliation must use separately approved SELECT-only access, before any separately authorized correction. Nothing here reads/writes private or production DB, changes individual member_votes, forecast/model/training/serving, scheduler, Senate floor scope or 2027 program; no public office contact. **Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN.**
