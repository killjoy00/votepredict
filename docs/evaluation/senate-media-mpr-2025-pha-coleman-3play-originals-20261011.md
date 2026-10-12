# MPR Senate evidence: 2025 Susan Pha and Julia Coleman 3Play original transcript PDF investigation

**VotePredict evidence Track D [#987](https://github.com/killjoy00/votepredict/issues/987) · October 11, 2026 (America/Chicago).** Public first-party source/history research only, not a production evidence update or privately reconciled source count.

## Result: current PDF bytes authenticated; 2025 historical original archive **not** authenticated

The previously merged [six-MPR-interview study](senate-media-mpr-six-interviews-public-reconciliation-20261011.md) left the original 2025 HTML transcript versions for **Susan Pha** and **Julia Coleman** unverified. Both currently served MPR interview pages include an **exact** American Public Media / 3Play transcript PDF hyperlink and current printed senator speaker labels. This study independently fetched **both current APM/CDN PDF binary bodies** with HTTP 200, validated the `%PDF-1.4` content despite `application/octet-stream`, and computed full original raw-body SHA-1 and SHA-256 and byte lengths. It also independently retrieved/hashes the **currently served MPR parent HTML**, confirming that each exact CDN link and two selected senator speaker-text cues appear in the current public page.

| Attribute | April 24, 2025 Susan Pha (veterans benefits) | September 11, 2025 Julia Coleman (political violence) |
| --- | --- | --- |
| MPR parent source | [Pha interview](https://www.mprnews.org/episode/2025/04/24/bill-granting-benefits-to-hmong-lao-veterans-passes-minnesota-senate) | [Coleman interview](https://www.mprnews.org/episode/2025/09/11/we-cannot-let-evil-win-minnesota-sen-julia-coleman-on-uptick-in-political-violence) |
| Exact separate first-party original CDN PDF | [APM 3Play Pha PDF](https://codytranscripts.apmcdn.org/production/f6c5cb374510772be01fbc20ea88d2d0.pdf) | [APM 3Play Coleman PDF](https://codytranscripts.apmcdn.org/production/2d9064e094aab7627c6e05a3c2aad608.pdf) |
| Current PDF byte count | **32,758** | **37,276** |
| Current PDF raw SHA-256 | `5e2b772277789a5470dc7803019aa970fbcd9566e4f60d8177fcb466eb1c0b9a` | `463c8e352130d0db9d3407470ae24226cb53f07f50d27515e9a0a6c689e493ca` |
| Current PDF raw SHA-1 (indexed-base32 format) | `RHRG7QQ6KKWUGFT25CRRNJLPBY4HIHYJ` | `UGIDHTEQLBNRADHFACP375KOZWDO6T45` |
| PDF embedded `/CreationDate` (self-declared) | `D:20250425043804Z`, April 25, 2025 04:38:04 UTC | `D:20250911192803Z`, September 11, 2025 19:28:03 UTC |
| **Current 2026** CDN HTTP `Last-Modified` | `Fri, 25 Apr 2025 04:38:10 GMT` | `Thu, 11 Sep 2025 19:28:12 GMT` |
| Difference between self-declared generation date and today-served HTTP `Last-Modified` | **6 seconds** | **9 seconds** |
| Currently served MPR raw parent HTML SHA-256 | `0171403131721bc673cfa7758dc9004af68990e5aba7fd27c8d3087871ac764b` (96,470 bytes) | `04d07480df86bf832f93840e8afac03df9f5121e79004a1c31d66e5f63430a33` (124,454 bytes) |
| Exact 2025 Wayback indexed historical PDF + replay | **UNKNOWN** — index unavailable | **UNKNOWN** — index unavailable |
| Selected 2025 Common Crawl exact-index original PDF WARC | **UNKNOWN** — 3 indexes unavailable | **UNKNOWN** — 3 indexes unavailable |
| Independently SHA1-index-authenticated **2025 original PDF** capture | **0 proven** (NOT proof none existed) | **0 proven** (NOT proof none existed) |

## Critical historic/publication-time interpretation

The embedded `/CreationDate` was generated *inside the PDF itself*. Today's HTTP `Last-Modified` is not an independently archived copy of the 2025 origin server response. Their tight six-/nine-second pairing is **consistent with** PDF production in the displayed 2025 year, but **does not certify first public posting, upload date, immutable binary identity in 2025, or availability at the date/time the MPR broadcast aired**. The current article, speaker-labeled transcript, link and PDF bytes are independently observed **now**, not historical archived original article/audio proof.

The Pha interview explicitly discusses a Senate vote that **already took place**. It must never be used to forecast that prior Senate passage, irrespective of whether the PDF was generated on April 25. The Coleman interview reflects a September 2025 public-safety discussion; no 2025 vote cutoff or senator stance evidence may be backdated from the PDF's metadata without independent original public-by and human-reviewed exact quote/source verification.

Selected exact 2025 CDX queries were only for these two APM PDFs (200 responses with exact indexed original identity, per-capture SHA-1, strict `id_` original-body replay). Three 2025 Common Crawl collections per PDF were chosen and could authenticate original compressed WARC byte-range responses only with `206`, original URL/date, original HTTP 200, indexed SHA-1, PDF magic and independent raw SHA-256. **All selected indexes were temporarily unavailable / not positively resolved**; no historical replays or WARC bytes were authenticated. This is explicitly `UNKNOWN`, never negative article evidence or a complete historical snapshot inventory.

## Immutable-ish source receipts and reproduction

The initial live public-only [GitHub Actions run #38193281218](https://github.com/killjoy00/votepredict/actions/runs/38193281218) **succeeded**, with **12/12** offline adversarial tests and actual current MPR/APM source retrieval. Original metadata ZIP artifact ID **11721928325**, SHA-256 `6b2ac1f148c5087b559fd2ff64989c0e872e963b5b7194f47bf0d2dc1f1159b9`; decoded metadata JSON **6,915 bytes**, SHA-256 `435d0d878f6fb32ea19272bfd191a414cc4c0ac95e258b786a1a830a94226f03`. These file hash/byte receipts are checked into [machine-readable public source manifest](senate-media-mpr-2025-pha-coleman-3play-originals-20261011.json). **No PDF, full transcript, audio, raw article HTML or WARC bytes were persisted.**

Reproduce on a network-enabled operator with no secrets or private DB:

```bash
node --test tests/senate-media-mpr-2025-pha-coleman-3play-originals.test.mjs tests/senate-media-mpr-2025-pha-coleman-real-receipts.test.mjs
node scripts/run-senate-media-mpr-2025-pha-coleman-3play-pdfs.mjs --output artifacts/mpr-2025-3play-proof.json
```

The live runner verifies that each currently fetched publisher PDF **still matches** this manifest's exact original PDF raw SHA-256, SHA-1, byte length, embedded creation-date field and current CDN `Last-Modified` before writing a new receipt; a changed PDF fails closed and must be independently investigated. The public HTML link and speaker/short-utterance cues also must still be present, but the current HTML SHA may drift as page templates change.

**Scope boundary:** Two current APM-produced PDFs authenticated to today's publisher service; **no** independent historical original 2025 PDF capture, original speaker MP3 SHA, complete reviewed named-senator passage, recorded Senate roll call, private source-document match, collector settings change, ingestion, Neon/Vercel writes, models or forecasts. This source work **does not** close [#987](https://github.com/killjoy00/votepredict/issues/987).

**Next evidence-only work:** find an independent historically dated 2025 publisher/APM/3Play PDF or 2025 current-audio source capture; try first-party MPR RSS and separately authenticated original issue-policy audio/HTML where feasible, carefully distinguishing *broadcast* and *transcript publication*. The February 23, 2022 Benson/Kunesh MPR joint interview also still lacks an independently authenticated historical-original transcript/speech; current page descriptions are not complete quotes.