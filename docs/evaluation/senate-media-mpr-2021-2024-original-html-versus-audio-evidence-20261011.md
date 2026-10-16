# Public MPR `/episode/` historical source and audio-lead audit — October 11, 2026

Research scope: *public* 2021–2025 Minnesota Senate media remarks. This is a bounded two-episode **case study**, not a statewide or MPR census, a production collector change, or an approval of senator audio/stance/voting assertions. Related issue: [#987](https://github.com/killjoy00/votepredict/issues/987).

## Original publisher page captures

The live public source workflow [#38173368712](https://github.com/killjoy00/votepredict/actions/runs/38173368712) authenticated FOUR exact original HTTP HTML bodies. A separate live repeat on an intermediate PR head [#38173683322](https://github.com/killjoy00/votepredict/actions/runs/38173683322) independently reverified all four. On a later PR-head replay [#38173800910](https://github.com/killjoy00/votepredict/actions/runs/38173800910), only the two 2021 original bodies were reacquired; the 2024 CDX lookup was transiently unavailable (UNKNOWN), not a contradiction of the two earlier original raw SHA-verified 2024 bodies. Each checked URL was a first-party MPR `/episode/` original, each CDX capture had a separately indexed original SHA-1, replay HTTP 200 + HTML MIME were required, and independently computed SHA-1 was compared before accepting any visible text or media reference. Original page HTML was not persisted.

| Source | Capture UTC | Indexed original SHA-1 (base32) | Raw original SHA-256 | Bytes | Selected current-page short text |
| --- | --- | --- | --- | ---: | --- |
| [Nov 15 2021 Jeremy Miller interview](https://www.mprnews.org/episode/2021/11/15/minnesota-senate-majority-leader-talks-bipartisan-effort-to-distribute-hero-pay) | 2021-11-15T21:55:12Z | `3PZ4AZNKIMNXWJLETZ2JSVWI7ZWXKGLF` | `a5dde038ca7558d8ed8209e57721443e84b569c7e0c7b4eb627be38265a730bf` | 91,141 | Selected reporter-attributed Miller cue **present** |
| Miller same source | 2021-11-15T23:26:33Z | `3PZ4AZNKIMNXWJLETZ2JSVWI7ZWXKGLF` | Same exact original SHA-256 | 91,141 | **present** |
| [Feb 19 2024 Grant Hauschild interview](https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south) | 2024-02-19T22:55:56Z | `DHKJFEB7VR76PWGE7EY2ZOUDZKLYKV5X` | `a990fb4207938f11b58b787966f67f1cc9577fd5c1d4feafe081bd8f14242387` | 80,716 | Selected current Hauschild wording and `GRANT HAUSCHILD:` label **not found** |
| Hauschild same source | 2024-02-20T03:02:16Z | `RBCAJH6FOUINBMBZWYXEX7GWIEIBHNDQ` | `da848c28bb3c3e1335076de4606ec472d8695a4c2533add45812614df3fc9536` | 80,716 | Selected current words and label **not found** |

Member identity records: [Jeremy Miller](https://www.lrl.mn.gov/legdb/fulldetail?ID=15335) and [Grant Hauschild](https://www.lrl.mn.gov/legdb/fulldetail?ID=15577). MPR attributes the former episode to Cathy Wurzer and Brian Bakst, and the latter to Cathy Wurzer and Alanna Elder. Both publisher pages display the corresponding research date. Page display date is **not** independently authenticated initial posting time.

**Critical version finding:** The current Hauschild MPR page includes a transcript with full speaker labels, but neither of two authenticated Feb 19–20 original HTML page bodies includes the two **selected** current-transcript text cues. MPR currently says the `Minnesota Now` transcript is *attempted the next business day after broadcast*. This supplies relevant publisher context, **not** proof of an exact historical transcript-insertion time. Do not backdate the selected text to the archival timestamps. The historical pages' **embedded audio resource references** are a different proof category from historical *transcript text*.

## Independent later-capture transcript version check (new)

The Hauschild page had **four** bounded exact CDX capture UTC rows across 2024–2025. Our original run sampled the earliest two. A separate, intentionally selective two-later-original-replay study [#38174084860](https://github.com/killjoy00/votepredict/actions/runs/38174084860) inspected the other two original page captures and independently verified both against the indexed SHA-1. This is not an extension of the replay limit in the original two-earliest study; it is a distinct, later-version change audit.

| Additional original MPR capture UTC | CDX SHA-1 | Raw original SHA-256 | Bytes | Selected current Hauschild transcript cues |
| --- | --- | --- | ---: | --- |
| **2024-02-20T03:02:36Z** | `RBCAJH6FOUINBMBZWYXEX7GWIEIBHNDQ` | `da848c28bb3c3e1335076de4606ec472d8695a4c2533add45812614df3fc9536` | 80,716 | Neither selected phrase nor named transcript label found; **identical raw body to the Feb 20 03:02:16 capture** |
| **2025-07-24T23:23:22Z** | `TKIPF5NUQ7HICXBKMOAPLBBOTJCVBLPO` | `9d1fddfd3983a138515175c6ffe7842cd37e54391a37932e8a503c43876bf725` | 121,462 | **Both** the current short quoted phrase and printed `GRANT HAUSCHILD:` label historically **present** |

Consequently, selected transcript wording appeared in the actual MPR original HTML by **July 24, 2025**, *not verifiably* in the three 2024 capture timestamps sampled. This does **not** establish the exact first transcript publication day, does **not** prove it was absent between archived snapshots, does **not** prove the wording was in a recorded 2024 audio binary, and does **not** convert an automated nearby full-name cue into manual approval of complete speaker transcription.

Across the **four different capture timestamps for this one MPR URL**, only **three distinct raw original HTML SHA-256 body identities** were observed, because the two Feb 20 captures share the same original raw body. Never count four archived versions as four different reported articles. The two 2021 Miller original timestamps likewise share one raw HTML identity. These new selected-source version data do not change any statewide census denominator.

Source receipt: [July 2025 authenticated positive and Feb 2024 authenticated negative original version identities](senate-media-mpr-hauschild-later-historical-transcript-cue-receipts-20261011.json). Tests include three synthetic proofs and three real-pinned-receipt regression assertions. No full HTML or source audio persisted.

## Recovered contemporaneous publisher media references

Both independently SHA-authenticated versions of each original page embed a publisher-domain MP3 URL path:

- **2021 Miller:** `https://play.publicradio.org/unreplaced_ua/o/minnesota/news/programs/2021/11/15/Minnesota_Senate_Majority_Leaders_talks_bipartisan_effort_to_distribute_hero_pay_20211115_64.mp3`
- **2024 Hauschild:** `https://play.publicradio.org/unreplaced_ua/o/minnesota/podcasts/minnesota_now/2024/02/19/mn_now_20240219_hauschild_20240219_128.mp3`

The historical HTML also embeds an alternate `%user_agent` spelling of each path. These count as two **episode audio-resource leads**, not four distinct authenticated audio recordings. The path appearing in an authenticated 2021 or 2024 HTML source proves the **link existed then**; it **does not** prove the MP3 bytes existed in a retrievable archive, that file's raw checksum, or what a senator spoke.

## Independent actual MP3 body checks

The separate bounded public [audio binary source workflow #38173683365](https://github.com/killjoy00/votepredict/actions/runs/38173683365) checked both original paths, exact original CDX indices for 2021–2025 and direct publisher GETs, with no automatic off-host redirect following. Six offline provenance/fail-closed tests passed. It found:

- **0** historically SHA1-authenticated original MP3 binary bodies.
- **2** exact CDX index requests unavailable or invalid (**UNKNOWN** historic availability).
- **2** present-day exact first-party media URLs responding with redirects that were **not followed** (neither publisher audio body nor original historical audio authenticated).
- **0** certified original recordings or full verbatim audio speaker quotations.

Do not translate missing CDX index or a present-day redirect into evidence a 2021/2024 recording was never published. A currently available full transcript is likewise not historical-original HTML/MP3 byte evidence.

## Reproducibility and boundary

- [Original two-episode raw HTML receipts](senate-media-mpr-2021-and-2024-original-episode-audio-link-receipts-20261011.json), including all four capture UTCs/sha1/sha256/byte counts.
- [Exact MP3 archive-index/current redirect result receipts](senate-media-mpr-original-mp3-unavailable-index-receipts-20261011.json), including original downloadable workflow artifact hashes.
- Original HTML audit: `scripts/probe-senate-media-mpr-episode-embeds.mjs`; negative/positive synthetic tests: `research/tests/senate-media-mpr-episode-embeds.test.mjs`.
- Audio byte audit: `scripts/probe-senate-media-mpr-original-mp3s.mjs`; tests `research/tests/senate-media-mpr-original-mp3s.test.mjs`.
- Live artifacts retain only hashes, capture UTC, bounded short phrase outcome, exact first-party MP3 URL lead and explicit UNKNOWN states. No original copyright source HTML or MP3 stored.
- Further research: validate historical publisher feed/enclosure GUID and distinct `%user_agent` URL form; obtain original first-party MP3 bytes with independently index-matched historical checksum, or a dated authentic publisher transcript whose own historical bytes are verifiable; human-review speaker context in retrieved original audio. #987 **remains OPEN**. #946 seven historical URL identities remain unresolved and out of scope for this MPR-only change.

**No individual senator's actual recorded floor/committee vote, initial publisher posting clock, population completeness fraction, full historical transcript, or private source/document coverage claim is established.**
