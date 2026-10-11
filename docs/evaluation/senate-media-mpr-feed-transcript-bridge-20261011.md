# Minnesota Senate media research: original MPR podcast audio and Hauschild transcript chronology

**Observed October 11, 2026 · public-only research · issue [#987](https://github.com/killjoy00/votepredict/issues/987) · PR #1144**

This work continues [PR #1138](https://github.com/killjoy00/votepredict/pull/1138), without reclassifying recorded votes or modifying production media collectors, evidence rows, private exports, forecasts, or model training. It has two separate source questions: (A) can contemporaneously page-linked MPR recordings be recovered, and is their **historical binary identity** verifiable; and (B) can the publication window of the printed Grant Hauschild transcript be further narrowed by genuinely original 2024–2025 publisher sources?

## A. Two actual first-party audio files now independently hashed

**Important positive discovery:** Previously SHA-authenticated original MPR HTML pages contained exact first-party `play.publicradio.org` episode MP3 resource references. Bounded GETs through specifically allowed MPR/APM first-party redirects reached `download.stream.publicradio.org`, returned **HTTP 200 / audio/mpeg**, and allowed raw MP3 bytes to be SHA-256 hashed in memory. These are **current publisher-hosted binaries**, not authenticated historical original audio bytes. We did not persist or distribute the MP3s, and have **not** independently listened, approved transcription, or assigned full recorded speech to the senators.

| Original MPR episode and speaker | Current publisher MP3 raw bytes | Independently computed current MP3 SHA-256 |
| --- | ---: | --- |
| [November 15, 2021 Jeremy Miller interview](https://www.mprnews.org/episode/2021/11/15/minnesota-senate-majority-leader-talks-bipartisan-effort-to-distribute-hero-pay), reporter/host Cathy Wurzer and Brian Bakst, [serving senator](https://www.lrl.mn.gov/legdb/fulldetail?ID=15335) | **2,606,791** | `41c845920ea87ec83c2b955c0e42101d36c03c2c7f9f6273357895aacc1b1b10` |
| [February 19, 2024 Grant Hauschild interview](https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south), Cathy Wurzer and Alanna Elder, [serving senator](https://www.lrl.mn.gov/legdb/fulldetail?ID=15577) | **6,638,508** | `894bdf42ed5bc383827a8cfd258531a7b49e9a3b7751d447f24eea1957ebe0b0` |

The original 2021 and 2024 historical **HTML** bodies proving the pages displayed the respective first-party audio URLs are SHA1/SHA256 pinned in [PR #1138's original HTML receipts](senate-media-mpr-2021-and-2024-original-episode-audio-link-receipts-20261011.json). Thus (i) the historical original article embedded an episode-specific MPR audio resource, and separately (ii) a publisher/CDN-hosted MP3 binary under the resource path is retrievable **now**. Do not collapse those into evidence that the exact retrieved 2026 bytes already existed in 2021 or 2024, or into speaker-audio review.

The current redirect chain used two separate HTTPS 302 hops on approved first-party MPR/APM hosts and ended at a valid `audio/mpeg` resource. Query-bearing CDN redirect values were processed transiently **in memory** and are never persisted or shown; only approved hostnames, paths and query-present flags are retained. Unapproved and tracking hosts are rejected.

**Independent historical binary check:** A separate bounded [original CDN MP3 study](https://github.com/killjoy00/votepredict/actions/runs/38176260623) queried the two derived *queryless* exact original CDN paths under `https://download.stream.publicradio.org/minnesota/...` against original Wayback CDX for 2021–2025 (source-specific range beginning on the episode day). Both exact historical index responses were **UNAVAILABLE/INVALID**. No source MP3 capture was replayed or SHA-authenticated. **0 historical MP3 raw bodies authenticated; 0 historically proven identity matches to the two current MP3s**. The queryless CDN hypotheses are each separate from the query-bearing redirected URLs and are *not assumed identical*. Unavailable CDX does not mean audio was not published.

Permanent results:
- [Current first-party MP3 raw hashes, identity chain and RSS/publisher context](senate-media-mpr-feed-transcript-bridge-20261011.json).
- [Exact original CDN MP3 index UNKNOWN receipts](senate-media-mpr-cdn-original-audio-20261011.json).
- [First positive current-file public run #38176008389](https://github.com/killjoy00/votepredict/actions/runs/38176008389): 11/11 offline security tests passed, two current publisher MP3s SHA-256 hashed; source artifact ZIP SHA256 `633769677ff0943362bb5afdc39116d5f6d70f3a446076184f14979dcad363d3`, decoded JSON SHA256 `2e2a22463e5e0632c5065022a9d61c74de32a95262bafbb9db799bce5d63e6c3`.
- [Exact historical-CDN archive run #38176260623](https://github.com/killjoy00/votepredict/actions/runs/38176260623): 5/5 offline tests passed, both exact original CDN CDX requests unknown, no archived MP3 bodies; ZIP SHA256 `938b2492161bb09d449fa74debd55fc44ee016eba654187f984c84beebfe5f8e`, decoded JSON SHA256 `165cb97880c8713552b1a4bd74f1812e079f810a26fae93a5629ef13ec6e0b82`.

## B. Hauschild historical transcript timing: publisher date metadata is NOT transcription posting proof

The exact first-party [2024-02-19 Hauschild MPR episode](https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south) currently displays a detailed speaker-labeled transcript, including the selected short cue about immigration being a federal issue.

Before this investigation, [PR #1138's independently authenticated original HTML versions](senate-media-mpr-hauschild-later-historical-transcript-cue-receipts-20261011.json) established:
- Original HTML **2024-02-19 22:55:56Z:** selected Hauschild speaker label and short specific words **NOT FOUND**.
- Original HTML **2024-02-20 03:02:16Z** and **03:02:36Z:** both cues **NOT FOUND** (two capture timestamps but one exact raw SHA-256 body identity).
- Original HTML **2025-07-24 23:23:22Z**, indexed SHA-1 `TKIPF5NUQ7HICXBKMOAPLBBOTJCVBLPO`, raw SHA-256 `9d1fddfd3983a138515175c6ffe7842cd37e54391a37932e8a503c43876bf725`, 121,462 bytes: **both cues FOUND**, including `GRANT HAUSCHILD:`.

**New publisher metadata observation:** The **currently served** first-party Hauschild article body was independently SHA-256 hashed (`19d29d71fb65f2252b42fe995613591eec97c1fab251c88b053a3d05f7cbbaa3`, 113,341 bytes) and has publisher-supplied structured metadata:
- `datePublished = 2024-02-19T10:32:03-06:00`.
- `dateModified = 2024-02-19T14:15:13.000-06:00`.

**Do NOT treat this `dateModified` as the transcript insertion clock.** It points to a publisher-displayed 2024 date, although the selected transcript words were absent from three **later February 2024 authenticated original HTML versions**. This metadata may refer to the article itself or another change; it cannot establish when a later embedded transcript was published. The 2025 historical positive remains the earliest **authenticated original HTML** with the selected short printed wording in our source sample. No earlier positive version was found in this work. This does not prove the phrase/transcript was absent between archived captures, nor anything about the recording.

**Four independent publisher original URL hypotheses** — no-`www` HTTPS, `www` HTTP, no-`www` HTTP and original HTTPS with trailing slash — were exact CDX queried for 2024–2025; all four index responses were **unavailable**. No duplicate/alias equivalence was established and no earlier transcript was authenticated. A further fetch of the already pinned July 2025 original temporarily returned an unexpected replay MIME, not a verified body; it does **not** invalidate earlier independently verified SHA1/SHA256 positive receipts.

## C. Official MPR Minnesota Now RSS source and its proof limits

MPR's [own podcast directory](https://www.mprnews.org/podcasts) explicitly links the official `https://feeds.publicradio.org/public_feeds/minnesota-now` source.

The current source responded with 114,571 bytes, SHA-256 `cae90ba656c559a5c24aa4b6cd1ee33f0030ad9bf9c1d6a83e01cf5ca61d965b`, but contained **no matching selected legacy Hauschild or Miller podcast item** in this bounded query. The exact archival feed CDX inquiry for **February 15–March 15, 2024** was unavailable/invalid. Therefore no contemporaneous XML enclosure/GUID, original historic XML bytes, or 2024 podcast feed publication date was independently certified by this audit. Absence of old items in the 2026 current feed says nothing about whether they were present in 2024. Do not equate a current RSS body with an archived feed.

## Research boundaries / next source gaps

The **public evidence improvement** is **two currently SHA-256-recovered first-party MPR MP3 binaries**, not historical byte-authenticated recordings. Current MPR date metadata was tested and found insufficient to narrow the historical HTML transcript availability interval. Source-specific unavailable CDX and transient MIME failure remain **UNKNOWN** rather than publication absence.

Next possible steps: independently authenticated 2021/2024 historical original MP3 capture with indexed SHA-1 plus raw SHA-256, or a historically authenticated publisher 2024 RSS enclosure/recording GUID; 3Play transcript original source versions with verified dates and source bytes if access is appropriately authorized; and human speaker approval only after actual audio/transcript comparison. Keep #987 **OPEN**.

No raw RSS, article HTML, full transcript, publisher MP3, whole copyrighted audio or third-party text persisted. No private evidence, recorded floor/committee vote, media collector, ingestion seed, forecast or model data was accessed or modified.
