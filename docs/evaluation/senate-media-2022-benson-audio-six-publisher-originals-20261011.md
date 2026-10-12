# Track D: exact 2022 Benson/Kunesh audio sources and six direct publisher historical originals

**Public-only historical evidence, observed October 11, 2026 (America/Chicago).** This is a bounded source/version audit, not a statewide media census, recorded vote, source-to-private-DB match, or human-approved speech transcript.

## Workflow and reviewed scope

- Initial verified live original-source workflow: [#38201877808](https://github.com/killjoy00/votepredict/actions/runs/38201877808), public artifact `11726132245`, initial source head `cd794cea30855cbbb75f776f6e55cfc751386b72`; eight offline synthetic tests passed.
- [PR #1208](https://github.com/killjoy00/votepredict/pull/1208) contains the small public-only probe, synthetic tests, pinned source receipts, and original-specific regression checks.
- Sources: exactly six selected first-party original publisher press/Q&A URLs from the pre-existing discovery ledger and the exact original named February 23, 2022 MPR interview URL. These **are not newly discovered page URLs**; the new work independently verifies historical original-body versions.
- Method: exact publisher URI, indexed Wayback timestamp/digest, replayed original HTML `200`/MIME, recomputed raw SHA-1 and SHA-256 and byte length; selected Common Crawl indexes and exact raw audio asset CDX consulted. Unavailable public index or failed replay is UNKNOWN. No redirect equated with an original without verification.

## Authenticated distinct source URLs, not duplicated archive versions

| Serving state senator / publisher source | First independently authenticated original UTC | SHA-256 of raw HTTP HTML body | Dedup with earlier work |
| --- | --- | --- | --- |
| Julia Coleman — 2021-coleman-sexual-assault-prospective | `2021-04-13T20:21:28Z` | `14b5aad174248d5cc693ccd2c7c1f23c7bbf096b625a11f500539fcc4ba53a77` | first capture previously authenticated |
| Jeremy Miller — 2021-miller-enterprise-manufacturing-qa | `2022-10-05T01:59:37Z` | `28dada90321263cbf20a75cc9949c176527a97c2d89d33c0831ed63469167f36` | newly historically authenticated distinct url |
| Eric Pratt — 2023-pratt-budget-tax-relief | **UNKNOWN** | — | Unverified candidate |
| John Marty — 2024-marty-online-sports-betting | `2024-03-02T15:32:31Z` | `811f59a8cdd46c7e2edabb8506a01773aa95ad1f74cb9af1e6baf39f84ca965d` | first capture previously authenticated |
| Susan Pha — 2025-pha-post-eichorn-charges | **UNKNOWN** | — | Unverified candidate |
| Julia Coleman — 2025-coleman-post-annunciation | **UNKNOWN** | — | Unverified candidate |

Of **6** selected distinct press/Q&A URLs, **3** had authenticated historical original bodies, across **6** capture versions. Two first-original versions were **already pinned earlier**: Coleman April 13, 2021, and Marty March 2, 2024, in `senate-media-2021-25-pinned-historical-original-phrase-review-queue.json`. Those two same-version SHA/UTC/byte matches were independently reconciled here, **not counted as two new pages**. Two more versions of those same URLs were newly authenticated. The newly first-authenticated distinct publisher URL is the Jeremy Miller Enterprise Minnesota interview, with two different authenticated original HTML versions; **net +1 historically first-authenticated distinct original URL across prior work**.

### Source-version reproducibility: all six authenticated originals

| Exact source id | Original UTC | Indexed base32 SHA-1 | Raw SHA-256 | Bytes | Short cue in original page | Named senator nearby |
| --- | --- | --- | --- | ---: | --- | --- |
| 2021-coleman-sexual-assault-prospective | `2021-04-13T20:21:28Z` | `E5W5QIEJ7OYPSD77AZZL5LTX7JAF2RVV` | `14b5aad174248d5cc693ccd2c7c1f23c7bbf096b625a11f500539fcc4ba53a77` | 88680 | true | true |
| 2021-coleman-sexual-assault-prospective | `2022-11-08T21:59:54Z` | `GNBMWSJMIEJGYBSWZIC537V4U5BC3HET` | `477aaed6ae57a54055780014d27cf1bbed460d0a01d377895fc4bb72e32cb962` | 89564 | true | true |
| 2021-miller-enterprise-manufacturing-qa | `2022-10-05T01:59:37Z` | `Z55ODFJANQV2PCOGS32J3IZE3GEL2DBR` | `28dada90321263cbf20a75cc9949c176527a97c2d89d33c0831ed63469167f36` | 65348 | true | false |
| 2021-miller-enterprise-manufacturing-qa | `2023-01-31T06:39:41Z` | `KDDZ7S7QX7HETNGDLYUQLZUUTAO5275J` | `fb8fd1d2c4bd209e54a905d5b050310a520a46d46f82c3a910a7270c723f3251` | 67207 | true | false |
| 2024-marty-online-sports-betting | `2024-03-02T15:32:31Z` | `VRFHI7EWTZONEMQQOQ43WCYTT77HZFAM` | `811f59a8cdd46c7e2edabb8506a01773aa95ad1f74cb9af1e6baf39f84ca965d` | 92875 | true | true |
| 2024-marty-online-sports-betting | `2024-05-25T19:27:51Z` | `CDEF57Y24B53NPWGQVHHSVUVB46WCZCV` | `6665e00288aa2b0be259eb86f4792171ab4dd240b67e67d9707f3b161e2b7f24` | 92735 | true | true |

All capture UTC values prove the particular indexed downloaded source **existed by** the capture time only. No first original publisher posting minute, exact audio speech, complete human-reviewed quotation or associated floor vote was proved.

### Statement attribution classification

- **Julia Coleman (March 2021 sexual-assault statute):** the original April 13, 2021 publisher body and another November 2022 version contain the selected prospective legislative-issue cue near her full name. This is an individually attributed **written caucus statement**, not separately verified recorded speech or a specific roll-call vote. Its public original was previously authenticated; the second version is additional version evidence.
- **John Marty (January 2024 online sports-betting concerns):** the first March 2, 2024 and second May 25, 2024 originals contain the selected short policy cue near his name. It is his named **written Senate DFL statement**, not broadcast audio; the first archived original was already known. The present page has both January 24/26 display dates, neither independently establishing the exact historical posting minute.
- **Jeremy Miller (publisher-dated November 2021 Enterprise Minnesota manufacturing Q&A):** independent originals from **October 5, 2022** and **January 31, 2023** both contain the selected short tax/wage/free-market text. The page presents a named `Miller:` printed Q&A **today**; the narrow historical replay cue search did **not** find his full name near that exact policy phrase. These raw bodies establish historical printed text presence, not yet verified original `Miller:` turn boundaries or historically authenticated November 2021 availability. Do **not** claim either exact original was public before the 2022 session or that Miller personally spoke the short fragment without additional bounded-turn verification.
- **Eric Pratt (Feb. 2023 surplus), Susan Pha (Mar. 2025 child-protection), Julia Coleman (Aug. 2025 school-safety):** the selected current-publisher original URLs remain historical-original **UNKNOWN** in this bounded run. Modern displayed dates and publisher attribution are not archive captures. Pha's 2025 release follows the cited charges; Coleman's August 2025 release follows the shooting. Neither predicts the triggering earlier event.

## February 23, 2022 Benson/Kunesh first-party MP3 originals — unresolved

The current named-interview MPR source exposed **exactly the same two pinned `play.publicradio.org` MP3 path-SHA256 fingerprints** as the earlier #1199 study:

- `1a775e898b632cc74d2281da8e2a93a88245364c9baf11e74685d27c9108931b`: exact archive index `index_unavailable_unknown`, **0 authenticated original audio binary versions**.
- `821cab3680de70bac205f93e49bd53964a756596e43a8e723b14ea94c88ffa91`: exact archive index `index_unavailable_unknown`, **0 authenticated original audio binary versions**.

The named page's exact historical Wayback CDX was `index_unavailable_unknown`, and the selected Common Crawl collection indexes did not yield an authenticated original replay. **No exact original HTML capture for the named program, no historical MP3 SHA-verified bytes, and no independently authenticated audio speaker turns.** Do not substitute the different February 23 parents'-rights program, whose two MP3 path fingerprints are distinct. Asset URL differences alone do not prove that actual audio binaries differ.

## Historical admissibility and private coverage limitations

Coleman's selected legislation text might be relevant to later votes *only if* an exact legislative event/cutoff and authentic text-before-cutoff are separately proved. Marty's original March 2024 version may be relevant only to later legislative events and is not automatically admissible on the current-page January date. Miller's first authenticated original in October 2022 is **too late to certify as pre-2022-session evidence**. Neither 2025 post-event statement can predict the earlier event it reacts to. No source is automatically eligible as a model feature.

This work checked **no** private VotePredict `source_documents`, `evidence_items`, Neon/production records or recorded votes. It made **no collector seed, schedule, ingestion, serving, database, training or forecasting changes**. URL-prefix and public archive-index failures remain discovery constraints, **not** production corpus missingness findings.

## Next bounded evidence actions

1. Authenticate Miller's exact `Miller:` Q&A speaker turn inside the October 2022 and January 2023 originals, requiring separate actual original content SHA and turn-boundary checks before individual attribution.
2. Search the two exact pinned named-program MPR audio assets in historically dated RSS/enclosures, independent audio/WARC archives, and exact original-page snapshots; keep sibling program identity separate.
3. Recover original 2023 Pratt, March 2025 Pha, and August 2025 Coleman caucus HTML if public indexes and authentic replay become available; do not infer global absence from this run.
4. Broaden to additional **different senators** and prospective direct publisher speech, including the historical 2024 Grant Hauschild North Star Act speaker-transcript/audio availability gap; preserve the original February 2024 transcript-versus-July 2025 version distinction.
5. Maintain #987 open; source-to-private-database completeness remains contingent on explicitly separately authorized limited VotePredict read-only export.

All receipts are digest/UTC/attribution metadata; no complete article HTML, original audio, archived WARC or full copyrighted transcript was committed.
