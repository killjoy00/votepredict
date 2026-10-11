# Original American Public Media/3Play transcript PDF for the 2024 Grant Hauschild MPR interview

**Public-only archival provenance · October 11, 2026 · [issue #987](https://github.com/killjoy00/votepredict/issues/987) · PR #1155.**

## Independent archive breakthrough

The [February 19, 2024 first-party MPR News interview](https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south), hosted by Cathy Wurzer, credits 3Play for transcript production and currently links the exact [American Public Media transcript PDF](https://codytranscripts.apmcdn.org/production/70fb369cef19a16a739671110457b6b9.pdf). This PDF is an **independent source document** from the HTML, MP3 and historical website snapshots in merged #1138, #1144 and #1152.

One **genuine original archival PDF HTTP body** has now been recovered and SHA-1 authenticated against an exact Wayback index entry. This is **not merely current website metadata**:

| Evidence | Result |
| --- | --- |
| Original archived exact PDF URL | American Public Media CDN PDF linked by today's MPR interview |
| Independently indexed PDF capture UTC | **2025-07-27 18:09:08Z** |
| Indexed original PDF SHA-1 (base32) | `S2P5473SIZ7Z6ZDAX4AJF7TMK2VFPXOZ` |
| Independently calculated archived raw PDF SHA-256 | `e246a7b8e9a12a47bd65c54031196a08395b02aed490369be954ac9647ce6991` |
| Original PDF raw bytes | **32,785** |
| Historical archived PDF MIME / validated file header | `application/octet-stream` / valid `%PDF-1.4` |
| Currently served first-party APM PDF | **Exactly the same 32,785 bytes and raw SHA-256** |
| PDF's own embedded creation metadata (in BOTH byte-identical bodies) | `D:20240220064202Z` = **February 20, 2024, 06:42:02 UTC** |
| HTTP Last-Modified on **2026-observed current response** | **Tue, 20 Feb 2024 06:42:10 GMT** |

**Careful date interpretation:** The first party PDF contains a self-reported February 20, 2024 creation clock; the currently served CDN independently presents a similarly dated Last-Modified header, eight seconds after that. These facts are consistent with the PDF being generated on Feb. 20, 2024. But **neither the embedded self-declared creation timestamp nor an HTTP Last-Modified returned in October 2026 proves its bytes were publicly served in February 2024**. Our first independently authenticated original PDF binary capture is **July 27, 2025**; we have not proved a February 2024 historical original PDF HTTP response, much less the initial publisher-first-publication clock. Do not backdate the 2025 archive date to the embedded timestamp.

## Three independently reverified original publisher HTML versions

The audit also successfully reacquired three previously pinned **original** Wayback MPR episode HTML bodies and matched BOTH their indexed SHA-1 and independently pinned raw SHA-256/byte lengths before checking the exact transcript-PDF URL and selected short speaker text:

| Exact MPR original capture UTC | SHA1/SHA256 pinned original source? | Exact 3Play PDF URL string in source? | Selected `GRANT HAUSCHILD:` transcript words? |
| --- | --- | --- | --- |
| 2024-02-19 22:55:56Z | **Yes** (80,716 bytes) | **No** | **No** |
| 2024-02-20 03:02:16Z | **Yes** (80,716 bytes) | **No** | **No** |
| 2025-07-24 23:23:22Z | **Yes** (121,462 bytes) | **Yes** | **Yes** |

The original 2024 pages precede the PDF's *claimed* creation time (February 20 at 06:42 UTC) and therefore do not contradict that metadata. The **July 24, 2025** genuine original MPR HTML page proves that the *exact PDF hyperlink* and specific printed speaker words appeared by that capture, three days before the separately SHA-authenticated **July 27, 2025** original PDF binary. This is a useful coherent source chain, not a certified February 2024 transcript publication date. Absence of one exact PDF string in early HTML is not proof that no other PDF or transcription resource existed then.

## Independent archive source tests and remaining unknowns

The exact original APM PDF Wayback CDX yielded **one** bounded indexed 200 original capture; direct original replay independently matched the index SHA-1 and current publisher PDF SHA-256. Three selected Common Crawl collection indexes for the exact PDF did **not** yield a separately authenticated WARC original: `CC-MAIN-2024-10` and `CC-MAIN-2025-30` had no selected indexed entry, while `CC-MAIN-2024-22` index lookup was unavailable (**UNKNOWN**). Missing selected index entries do **not** establish that no historical PDF existed there.

Source scripts: `scripts/probe-senate-media-mpr-hauschild-3play-pdf.mjs` and `scripts/run-senate-media-mpr-hauschild-3play-pdf.mjs`, with tests covering original URL identity, PDF magic, metadata extraction, original CDX indexed SHA-1, strict Common Crawl WARC envelope, range-206, size caps, original HTTP MIME and fail-closed mismatch handling. No source PDF content, full transcripts, original HTML, WARC bytes, MP3 audio or other copyrighted source binaries are persisted.

The positive first public run [#38178140236](https://github.com/killjoy00/votepredict/actions/runs/38178140236) passed **12 offline evidence/safety tests** and collected only a JSON metadata/identity artifact, whose ZIP SHA256 is `e733a4eafe58b4d4a82bf12e63f113a2ae18bd8a67565f0db15a1df3fc51e24c` and decoded original JSON SHA256 is `d9727eee6ec4b03a0fc214a3b8d3ea1e8b24cabdf6bd58f89e3e0fa7a29e7a98` (6,176 bytes).

[Machine-verifiable permanent PDF/HTML checksum and timing receipts](senate-media-mpr-hauschild-3play-transcript-pdf-provenance-20261011.json).

### Next evidence priorities

An authentic earlier 2024 archive of the exact transcript PDF bytes or credible independent first-party posting logs would narrow the *public availability* date; a publisher-displayed PDF creation timestamp alone cannot. Existing #1144 current 2026 publisher MP3 SHA256 paths, while useful, remain distinct from verifying historical original 2024 audio binaries. Specific MPR transcript speaker passages need separate contextual/human source verification before any whole-statement or audio-verbatim approval. A senator's statement about how they *would* vote is **not an official recorded Senate floor or committee vote**.

**#987 remains OPEN.** No private evidence exports, production collector or seed updates, recorded roll calls, model/training/forecast changes or production database access were performed.