# #864 — first actual one-time caption source audit: 2023 partial failure retained

The full original [one-time GitHub source workflow #38103766440](https://github.com/killjoy00/votepredict/actions/runs/38103766440), introduced in merged [PR #999](https://github.com/killjoy00/votepredict/pull/999), **ended in FAILURE** because two official 2023 media HTML pages failed to re-fetch. This must not be represented as a successful 138/138 audit. The **2022, 2024 and 2025 original jobs did succeed**, and the 2023 job retained a complete metadata-only partial outcome.

The four actual uploaded ZIP archives and decoded JSON bodies were downloaded and independently SHA256 checked. Their exact artifact IDs, ZIP SHA, JSON SHA, first-run event outcomes and nine specific unresolved source IDs are now in [permanent original source ledger](./source-proof/senate-committee-138-original-caption-surface-first-run-ledger.json), checked by [fail-closed regression](../../tests/senate-committee-138-original-caption-first-run-ledger.test.ts).

| Original LRL index year | Dated media record leads | Original record HTML SHA reverified | Failed original page requests | Pages with timed-caption markers | Caption timestamp marker occurrences (not statements or votes) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2022 | 11 | 11 | 0 | 10 | 24,147 |
| 2023 | 64 | **62** | **2** | 56 | 162,749 |
| 2024 | 41 | 41 | 0 | 41 | 122,128 |
| 2025 | 22 | 22 | 0 | 22 | 47,306 |
| **Total** | **138** | **136** | **2** | **129** | **356,330** |

All **136** actually re-fetched original HTML pages exactly matched their independently authenticated earlier original HTML SHA-256. All *successful caption-interface requests* respected a strict same-host URL whitelist, response content type and byte cap. Two fetch errors were in **2023 Taxes**, **January 12** (media record `1046920`) and **February 8** (`1047266`); the errors are **not** proof of an unavailable recording, absent hearing or no votes.

## Seven re-fetched pages without timed captions

- **2022-03-15 Housing Finance and Policy**, `mtgid=1046040`: safe caption response returned **zero `data-time` markers**, despite an HTML audio/video player.
- **2023-01-10 Taxes**, `mtgid=1046896`: safe caption response likewise returned **zero** timed rows.
- **2023-02-21 Taxes `1047437`**, **Mar 7 Taxes `1047599`**, **Mar 14 Taxes `1047707`**, **Apr 13 Environment/Climate/Legacy `1048027`**, **Apr 13 Taxes `1048030`**: HTML audio-player markup but **no same-host `showcaptions` video request**. These are five *audio-only* metadata leads, not five certified unrecorded hearings. Explore genuinely accessible sound separately; do not infer senator votes from captions, silence or aggregate voice reports.

The original year-2023 download failure should be retried in a **narrow, pinned two-original-source** acquisition without recrawling the 207 already OCR-recovered PDF corpus or resetting the valid 2022/2024/2025 proofs. Until then total caption accessibility is partial. Caption timestamp counts are indicators of a source response structure, **not** a count of words, spoken statements, unique motions, named YEA/NAY observations, or verified audio/video playback.

## Remaining completeness

After source availability is independently established, human review of original *motion-time* hearing content, bill/amendment identity, exact speaker, actual recorded member choices and hearing timing is necessary. Official original Senate 2021 printed Minutes, official 2022 print/electronic reconciliation, complete recorded committee vote denominators and private persisted source/evidence parity remain unresolved. The separate CFB, campaign issue-page and media quote denominators remain unknown.

**No media or PDF bytes, full caption text, member-choice lists, production database access, forecast, model, serving, training, scheduler, Senate floor expansion, 2027 work or office contact. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN.**
