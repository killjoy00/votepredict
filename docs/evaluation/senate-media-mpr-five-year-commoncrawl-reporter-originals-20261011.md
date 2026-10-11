# Public original MPR reporting: six new Senate source stories and one authenticated Common Crawl WARC

**October 11, 2026 · public-only investigation · issue [#987](https://github.com/killjoy00/votepredict/issues/987) · PR #1152.**

Independent sequel to [#1138](https://github.com/killjoy00/votepredict/pull/1138) and [#1144](https://github.com/killjoy00/votepredict/pull/1144). Those studies established two original MPR `/episode/` HTML sources, publisher-audio-resource references, and two **currently served** MP3 byte hashes (but no independently authenticated **historical original** MP3 file). This round broadens selected **independent newsroom reporting** to six `/story/` URLs and investigates Common Crawl original WARC records as a second historical archive source.

## Distinct historical publisher-page wins

**Six** new distinct first-party MPR `/story/` URLs were selected across **five** displayed publication years, 2021–2025. Current MPR publisher HTML contains **seven** short, reporter-attributed, individually named historical Minnesota senator public speech *candidates* (three names across stories: Jeremy Miller, Mary Kunesh, Bobby Joe Champion). These are **seven article-speaker candidate turns**, not seven separate senators or approved full audio quotes.

**Four** original MPR reporting stories had an independently SHA-1-authenticated historical original HTML body with the selected short senator fragment present; altogether, **seven** SHA-verified historical capture timestamps, **six distinct raw SHA-256 original body identities**, and **seven positive short-cue-by-capture checks**. No source was approved for full utterance/speaker-verbatim or actual recorded individual Senate votes.

| Displayed publisher day | Serving Senate speaker | Selected source topic | Original archived HTML verified | Short selected statement clue verified |
| --- | --- | --- | ---: | --- |
| [2021-11-23](https://www.mprnews.org/story/2021/11/23/stalemate-over-special-session-appears-to-be-easing) | [Jeremy Miller](https://www.lrl.mn.gov/legdb/fulldetail?ID=15335) | Special-session negotiations / commissioner bargaining | **3 captures (2 Wayback, 1 Common Crawl WARC)** | **3/3** |
| [2022-02-15](https://www.mprnews.org/story/2022/02/15/new-political-district-maps-shake-up-minnesota-politics) | Jeremy Miller | Redistricting reaction | **2 Wayback captures** | **2/2** |
| [2023-04-18](https://www.mprnews.org/story/2023/04/18/minnesota-moves-to-protect-native-children-as-supreme-court-decision-looms) | [Mary Kunesh](https://www.lrl.mn.gov/legdb/fulldetail?ID=15466) | Tribal child welfare | **0; archive indexes unavailable** | Current page candidate only |
| [2023-12-06](https://www.mprnews.org/story/2023/12/06/minnesota-schools-ethnic-studies-what-that-might-look-like) | Mary Kunesh | Ethnic-studies education | **1 Wayback capture** | **1/1** |
| [2024-05-06](https://www.mprnews.org/story/2024/05/06/tribal-members-reflect-on-anniversary-indian-citizenship-act-minnesota) | Mary Kunesh | Indian Citizenship Act centenary / voting rights | **1 Wayback capture** | **1/1** |
| [2025-01-23](https://www.mprnews.org/story/2025/01/23/the-chamber-that-chose-cooperation-minnesota-senate-sees-smoother-sailing-under-temporary-tie) | Jeremy Miller and [Bobby Joe Champion](https://www.lrl.mn.gov/legdb/fulldetail?ID=15317) | Senate bipartisan temporary power-sharing arrangement | **0; archive indexes unavailable** | Two distinct current-page candidates only |

**Caution:** No historical original recovered for 2023 April Kunesh or 2025 Miller/Champion in the chosen bounded archive source/collection sample. Index lookup unavailable (**UNKNOWN**) does *not* imply that earlier statements were absent or that those pages were never archived. Current MPR HTML can support lead discovery, not historical-original byte authentication. These selected stories are **not** an exhaustive MPR census or statewide population denominator.

## First verified independent Common Crawl publisher WARC: 2021 Jeremy Miller

For the **Nov. 23, 2021 Jeremy Miller MPR reporter story**, actual *original HTTP payload* was obtained through an independently indexed [Common Crawl collection `CC-MAIN-2021-49`](https://index.commoncrawl.org/CC-MAIN-2021-49-index), using its exact original URL, capture UTC, SHA-1 digest, WARC segment path, offset and compressed length. The probe required HTTP **206** for the precise compressed-range retrieval, validated the WARC envelope's exact original target URL, recorded `WARC-Date`, original publisher HTTP **200**, HTML MIME and reported WARC length, and **recomputed the SHA-1 of the extracted original HTTP publisher HTML bytes**. Only after SHA-1 matched the index did it test the selected reporter speech fragment.

| Original source archive | Capture UTC | Indexed original SHA-1 (base32) | Independently computed raw SHA-256 | Original bytes |
| --- | --- | --- | --- | ---: |
| Wayback original | **2021-11-23 17:23:44Z** | `7JZMYLLUKOZBZNJKACVGCMDKVQ3GWPPF` | `f408705f15ad5c11f17934bba5471380b524ac6759093929d807352ee68595df` | **97,356** |
| Wayback original | **2021-11-23 19:06:11Z** | Same SHA-1 | Same SHA-256 | **97,356** |
| **Common Crawl original WARC** | **2021-11-28 08:51:53Z** | `LUTKMXAJOTUX7CK5IGYNDAQGOQ5NOISZ` | `a01c6768bdb2ba48abaa0635026b7536c21e1ef55506cf9b572d101bdbf90519` | **97,359** |

The two Wayback timestamps share **one exact raw HTML body identity**. The separate Common Crawl capture is **three bytes longer**, represents a **different authenticated raw original HTML byte identity**, and contains the same selected Miller short cue. It is not a duplicate article nor proof of the first published clock.

Common Crawl exact WARC provenance: original path `crawl-data/CC-MAIN-2021-49/segments/1637964358480.10/warc/CC-MAIN-20211128073830-20211128103830-00046.warc.gz`, HTTP range offset **987,980,969**, compressed record **21,214 bytes**. Original WARC bytes never persisted. The indexing proof supports independently validating historical MPR reporting even when a given Wayback CDX query is unavailable, but is only one example; other 2022–2025 Common Crawl collection queries in this round were unavailable/invalid.

## The other four authenticated original publisher versions

- **Feb. 15, 2022 Miller/redistricting:** Wayback originals **2022-02-15 22:24:06Z**, raw HTML SHA-256 `670faec80cb39886d8fb2d2acb9bc03a1dd3471958c1447aeffc5f51bf396b7f` (**147,874** bytes) and **2022-02-16 05:33:35Z**, SHA-256 `6dbfabf945642cb185737da25a1d8071b3b7863d2cb4bad9994a806ac8a92621` (**152,234** bytes). Two distinct original body versions, selected Miller phrase present with nearby full name in both. Neither proves an individual Senate roll call.
- **Dec. 7, 2023 Kunesh/ethnic studies:** original **2023-12-07 15:24:32Z**, indexed SHA-1 `XX72GW73HNB2VEKF7DYUQOI2NHXFMBPU`; SHA-256 `a00902933919c7fbca13a37641081ee3ac5189bfd0d171845c1cbb61294c36a0`, **245,257** bytes. Selected Kunesh phrase and nearby name verified in actual historical original HTML. Earlier **2023-12-06 20:09:50Z** candidate replay did **not** match its index SHA-1, so it is **UNKNOWN**; do not claim the selected words were or were not in those unverified bytes.
- **May 7, 2024 Kunesh/Indian Citizenship Act:** original **2024-05-07 01:16:08Z**, indexed SHA-1 `VYIELFT7JAW76ZL2DULOHU3ZTZNNDHGZ`; SHA-256 `c31220d3ad534895b358e3ce5927e95d6e85b3d1da3f18753986343d26d31846`, **109,468** bytes. Selected senator remark and nearby name verified. Another original capture indexed **2024-05-06 22:03:39Z** failed during archive replay; its actual content remains UNKNOWN.

## Hauschild historical transcript independent archive follow-up

The previously verified [February 19, 2024 Grant Hauschild MPR episode](https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south) was also independently queried against selected Common Crawl **2024-10**, **2024-18**, and **2025-30** collections and Wayback. All these new index queries were **unavailable/invalid**. That does not erase #1138's existing three authenticated 2024 HTML capture timestamps **without** selected transcript cues and an original **July 24, 2025** HTML capture **with** both selected words and `GRANT HAUSCHILD:`. The initial precise transcript-posting clock is still unverified, and no actual original 2024 MP3 binary was historically SHA-authenticated in this round.

## Auditing and strict boundaries

[Permanent per-original-index/UTC/SHA/byte and cue receipt](senate-media-mpr-five-year-commoncrawl-reporter-original-receipts-20261011.json) pins the successful live original public workflow [#38177618699](https://github.com/killjoy00/votepredict/actions/runs/38177618699), exact source PR head `0354ecc8b84bc6f39965eb031848336d9ca8ffa2`, raw artifact ZIP SHA-256 `e8e71033ac4558737bddfd7608c5c502e10eeb6e91704d6bd27f05b3a4e9f879`, decoded JSON SHA-256 `07bbf621f55ceb9fcf0aa398260a116857eb84d96e56ef99fc503a548d0c0cf9`, **25,487 bytes**.

Source scripts `scripts/probe-senate-media-mpr-five-year-commoncrawl-originals.mjs` and `scripts/run-senate-media-mpr-five-year-commoncrawl-originals.mjs`; offline adversarial and real source receipt tests `tests/senate-media-mpr-five-year-commoncrawl-originals.test.mjs` and `tests/senate-media-mpr-five-year-real-receipts.test.mjs`. The indexed record must have the exact original publisher URL, allowed UTC, HTTP 200 HTML, independently matched original raw SHA-1 before quote cues. The caller does not follow unknown redirects or download unrelated off-host WARC or source files. Raw copyrighted HTML/WARC/PDF/MP3/audio and full quotations are not persisted in repository or actions artifact.

Future work: validate contemporaneous [3Play/APM-hosted transcript PDF](https://codytranscripts.apmcdn.org/production/70fb369cef19a16a739671110457b6b9.pdf) and its own historical original archive date/checksum, additional Common Crawl collections for 2023/2025 gap articles, or genuine archived original MP3 byte identities. Only promote specific senator text after individual source/attribution review and separately verify recorded legislature votes against official Senate roll-call documentation.

**No production collector, ingestion seeds, forecasts, models, training, private evidence, individual Senate votes or historical transcript arrival-time claims were modified. #987 remains OPEN.**
