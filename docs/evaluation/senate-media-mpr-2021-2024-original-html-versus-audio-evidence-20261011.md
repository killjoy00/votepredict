# Public MPR `/episode/` historical source and audio-lead audit — October 11, 2026

Research scope: *public* 2021–2025 Minnesota Senate media remarks. This is a bounded two-episode **case study**, not a statewide or MPR census, a production collector change, or an approval of senator audio/stance/voting assertions. Related issue: [#987](https://github.com/killjoy00/votepredict/issues/987).

## Original publisher page captures

The live public source workflow [#38173368712](https://github.com/killjoy00/votepredict/actions/runs/38173368712) authenticated FOUR exact original HTTP HTML bodies. Final-head repeat [#38173683322](https://github.com/killjoy00/votepredict/actions/runs/38173683322) independently reverified all four. Each checked URL was a first-party MPR `/episode/` original, each CDX capture had a separately indexed original SHA-1, replay HTTP 200 + HTML MIME were required, and independently computed SHA-1 was compared before accepting any visible text or media reference. Original page HTML was not persisted.

| Source | Capture UTC | Indexed original SHA-1 (base32) | Raw original SHA-256 | Bytes | Selected current-page short text |
| --- | --- | --- | --- | ---: | --- |
| [Nov 15 2021 Jeremy Miller interview](https://www.mprnews.org/episode/2021/11/15/minnesota-senate-majority-leader-talks-bipartisan-effort-to-distribute-hero-pay) | 2021-11-15T21:55:12Z | `3PZ4AZNKIMNXWJLETZ2JSVWI7ZWXKGLF` | `a5dde038ca7558d8ed8209e57721443e84b569c7e0c7b4eb627be38265a730bf` | 91,141 | Selected reporter-attributed Miller cue **present** |
| Miller same source | 2021-11-15T23:26:33Z | `3PZ4AZNKIMNXWJLETZ2JSVWI7ZWXKGLF` | Same exact original SHA-256 | 91,141 | **present** |
| [Feb 19 2024 Grant Hauschild interview](https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south) | 2024-02-19T22:55:56Z | `DHKJFEB7VR76PWGE7EY2ZOUDZKLYKV5X` | `a990fb4207938f11b58b787966f67f1cc9577fd5c1d4feafe081bd8f14242387` | 80,716 | Selected current Hauschild wording and `GRANT HAUSCHILD:` label **not found** |
| Hauschild same source | 2024-02-20T03:02:16Z | `RBCAJH6FOUINBMBZWYXEX7GWIEIBHNDQ` | `da848c28bb3c3e1335076de4606ec472d8695a4c2533add45812614df3fc9536` | 80,716 | Selected current words and label **not found** |

Member identity records: [Jeremy Miller](https://www.lrl.mn.gov/legdb/fulldetail?ID=15335) and [Grant Hauschild](https://www.lrl.mn.gov/legdb/fulldetail?ID=15577). MPR attributes the former episode to Cathy Wurzer and Brian Bakst, and the latter to Cathy Wurzer and Alanna Elder. Both publisher pages display the corresponding research date. Page display date is **not** independently authenticated initial posting time.

**Critical version finding:** The current Hauschild MPR page includes a transcript with full speaker labels, but neither of two authenticated Feb 19–20 original HTML page bodies includes the two **selected** current-transcript text cues. MPR currently says the `Minnesota Now` transcript is *attempted the next business day after broadcast*. This supplies relevant publisher context, **not** proof of an exact historical transcript-insertion time. Do not backdate the selected text to the archival timestamps. The historical pages' **embedded audio resource references** are a different proof category from historical *transcript text*.

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
- Original HTML audit: `scripts/probe-senate-media-mpr-episode-embeds.mjs`; negative/positive synthetic tests: `tests/senate-media-mpr-episode-embeds.test.mjs`.
- Audio byte audit: `scripts/probe-senate-media-mpr-original-mp3s.mjs`; tests `tests/senate-media-mpr-original-mp3s.test.mjs`.
- Live artifacts retain only hashes, capture UTC, bounded short phrase outcome, exact first-party MP3 URL lead and explicit UNKNOWN states. No original copyright source HTML or MP3 stored.
- Further research: validate historical publisher feed/enclosure GUID and distinct `%user_agent` URL form; obtain original first-party MP3 bytes with independently index-matched historical checksum, or a dated authentic publisher transcript whose own historical bytes are verifiable; human-review speaker context in retrieved original audio. #987 **remains OPEN**. #946 seven historical URL identities remain unresolved and out of scope for this MPR-only change.

**No individual senator's actual recorded floor/committee vote, initial publisher posting clock, population completeness fraction, full historical transcript, or private source/document coverage claim is established.**
