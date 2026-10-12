# First authentic 2023 MPR senator printed-transcript cues: Mary Kunesh and Native family preservation

**VotePredict MPR public evidence issue [#987](https://github.com/killjoy00/votepredict/issues/987). Original-source research October 11, 2026 (America/Chicago).** Historical media statement proof only: no database, new collector, actual recorded Senate votes, inference training, forecast or prediction changes.

## Why this is a distinct evidence finding

[Earlier archived speaker-turn review](senate-media-mpr-kunesh-original-speaker-turns-20261011.md) showed that a previously chosen February 2023 Kunesh policy excerpt appeared in a **newsroom description before the `Audio transcript` heading**, while the page's separate `MARY KUNESH:` labels were inside the transcript. Checking those **two independently present strings on the same page** had wrongly appeared to qualify a direct senator transcript quote. The same earlier review successfully authenticated a December 2024 charter-school reform short phrase **inside** Kunesh's own labeled transcript turn, but that December 2024 page version must not be backdated to the October 22 broadcast.

This continuation selects **two other short excerpts** from the currently served, first-party Feb. 7, 2023 MPR interview's *actual printed `MARY KUNESH:` responses*, not the reporter summary. The selected topics are (1) the Minnesota child-welfare law's protection for tribal identity, and (2) family-first placements for Native children. It tests both against the **genuine independently SHA1-index-authenticated original MPR HTTP HTML** for the Feb. 7 interview captured **Feb. 10, 2023** (then independently repeats on an April 2024 capture). It preserves the previous newsroom-summary phrase as a **negative control** so a later regression cannot mistakenly approve it.

## Source originals and specific attributable printed-turn outcome

| Exact original | Source digest and byte count | Tribal identity short cue | Family-first placement short cue | Newsroom-summary control |
| --- | --- | --- | --- | --- |
| [2023 Mary Kunesh / MPR Indian Family Preservation Act interview](https://www.mprnews.org/episode/2023/02/07/new-bill-would-keep-native-families-together-proponents-say), **2023-02-10 02:40:30 UTC** | indexed SHA1 `LSMKP7LJQX2FXTNTSFGN2ACEJ6J46GIV`; original SHA256 `091376b6f0a3a0a1104d9aa8bd4573212c2ba5953486c082df2877a8eb041f92`, 81,419 bytes | **Inside `MARY KUNESH:` printed transcript turn**, offset 394 characters | **Inside `MARY KUNESH:` printed transcript turn**, offset 397 characters | Visible *elsewhere on page*; **not** inside `Audio transcript` or senator's turn |
| **2024-04-18 02:46:06 UTC** capture of **same 2023 interview URL** | indexed SHA1 `KTSNDQOWIHKHV2IYGL7T6XWY5W3EZDXN`; original SHA256 `40d95fdf4f17d5e5c32f0c3b574e47af83a0526735bef33a9d0ddce09b93b89b`, 82,580 bytes | **Inside senator's printed transcript turn**, offset 394 | **Inside senator's printed transcript turn**, offset 397 | **Outside printed transcript** |

**Historical public-by boundary:** the precise printed short-policy transcript fragments occurred **by the Feb. 10, 2023 02:40:30 UTC independently authenticated archive capture**. This establishes a documented original publisher text and named labeled turn before any later dates; it does **not** independently establish exact Feb. 7 broadcast-time transcript availability, first transcript upload time, exact human-approved **full** verbatim quote, correspondence with originally aired audio, or eligibility for any particular Senate vote cutoff.

The two specific short fragments serve **different policy statements** within the same existing MPR original interview URL. They are **not** two extra articles or two distinct speaker identities. Their original indexed SHA1 and raw SHA256 were reverified independently for every selected cue; original source replay used six total SHA-pinned body checks across two previously known source versions. The negative-control phrase was selected specifically because the prior report proved it existed on the page but not inside the original transcript's senator turn.

## Reproducible constrained source proof

The initial public-only [GitHub Actions source verification run #38194711492](https://github.com/killjoy00/votepredict/actions/runs/38194711492) **SUCCESS**: **6/6 synthetic tests** and **6/6 actual original body SHA-1/SHA-256/size replays**, two new short printed MPR policy speaker-turn candidates in the Feb 10 original and the reporter-summary negative control correctly excluded. Public metadata artifact id `11722727635`, never full HTML, audio or transcripts. Permanent [source UTC/hash and speaker-turn boolean JSON](senate-media-mpr-kunesh-2023-original-in-turn-20261011.json) is checked in.

```bash
node --test tests/senate-media-mpr-kunesh-2023-original-in-turn.test.mjs tests/senate-media-mpr-kunesh-2023-original-receipts.test.mjs
node scripts/run-senate-media-mpr-kunesh-2023-speaker-cues.mjs --output artifacts/mpr-kunesh-2023-speaker-cues.json
```

Original source checks require exact previously authenticated original URL, UTC capture, index SHA-1, independent raw SHA-256 and bytes; any archive replay/network/redirect failure remains **UNKNOWN**, rather than absence. Selected short cue ownership uses bounded full uppercase speaker-label turns after `Audio transcript` and prior same-turn parser. Runner compares observed source and cue outcomes with permanently pinned real-receipt JSON and fails closed on any drift. Raw HTML/PDF/MP3/WARC and entire copyrighted transcript content never leave process memory.

## Boundaries and next evidence step

These findings are source-authenticated **publisher printed speech-fragment attributions**, not original voiced MP3 authentication or human-certified whole spoken quote, legislative roll-call vote, direct stance promotion, sentiment score, historical model input, or VotePredict's private `source_documents`/`evidence_items` coverage. The original publisher/Wayback page says what the printed MPR transcript contained at that captured time and who the text labels; verifying original broadcast audio and transcript first public date remains a separate question. No production collector or model change authorized.

Prioritize additional **distinct senators** and original historic audio rather than repeatedly counting the same two Kunesh episodes. The 2022 joint Michelle Benson/Mary Kunesh MPR interview remains unverified historical audio/transcript; the 2025 Susan Pha/Julia Coleman current APM PDF originals have hashes but no independently verified 2025 archive originals. Issue #987 stays open.