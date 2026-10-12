# Track D: 2022 authentic senator statements matched to three later standalone YES votes

**Evidence-only result for [issue #987](https://github.com/killjoy00/votepredict/issues/987), 2026-10-12.** This closes the focused primary-Journal **individual ballot** gap for the 2022 education/parents'-rights test cases, following the original historical first-party caucus source independently authenticated in [#1235](https://github.com/killjoy00/votepredict/pull/1235). It does **not** automatically create production VotePredict voting labels or forecast features.

## Decisive: the official original Senate Journals list all three senators in YES

| Senator | Standalone Senate bill | Actual vote date | **Personal vote** / chamber count | Revisor-indexed printed Senate Journal page | Actual original Journal PDF page | Role |
| --- | --- | --- | --- | ---: | ---: | --- |
| **Roger Chamberlain** | **SF2729** | 2022-03-03 | **YES** (67–0) | 5209 | 17 | supporting_control |
| **Paul Gazelka** | **SF2575** | 2022-03-03 | **YES** (37–30) | 5209 | 17 | primary |
| **Michelle Benson** | **SF2666** | 2022-03-10 | **YES** (36–31) | 5293 | 25 | primary |

The three individual YES results were read from the **correct bill's third-reading passage roll** in the downloaded original Senate PDFs. For each, the bill number was the nearest preceding Senate File and its third-reading context explicitly matched; the named senator was in the affirmative roster, **not** merely the bill's author list, an aggregate 36–31/37–30/67–0 tally, a nearby attendance list, or a Rule 40 proxy-only note. The 67–0 Chamberlain bill is a **supporting control**, not a discriminating close vote.

### Full original Minnesota Senate Journal PDF provenance

| Exact first-party original | Raw bytes | Total PDF pages | SHA-256 of *entire downloaded original PDF* |
| --- | ---: | ---: | --- |
| [2022-03-03 Senate Journal](https://www.senate.mn/journals/2021-2022/20220303073.pdf) | 412,715 | 18 | `57508a799f660850e0794b4f09a7c958cd72dff606e58a493f7557a15358aa3b` |
| [2022-03-10 Senate Journal](https://www.senate.mn/journals/2021-2022/20220310076.pdf) | 508,243 | 26 | `3319cd7bbcebaca4b19657eb6a99d2a8cf70ee9b03251b608513084e235cb431` |

Source originals were fetched under exact 2021–22 session day URLs, with no redirects, expected PDF HTTP MIME and signature/footer, byte caps, extracted page count and named roll-voter sections. The CI runner has no guaranteed external Poppler command, so the verifier supports the repository's already-installed `pdf-parse` fallback with **original PDF page boundaries** preserved. It never treats an extraction failure as a negative ballot. Only hashes, lengths, pages, member-vote flags and bounded text-match metadata are retained.

## A contemporaneous, first-party written position **before** these votes

The [February 14, 2022 original Minnesota Senate Republican Caucus Parents' Bill of Rights release](https://www.mnsenaterepublicans.com/senate-republicans-propose-parents-bill-of-rights/) was independently Wayback **index-SHA1 and raw-original-SHA256 authenticated** at **2022-02-14T23:24:11Z** (original HTML **91,008 bytes**, indexed SHA1 Base32 `QKCIZE6CX4AZ2ZUOT6JNUNDKNYRYLEGP`, full original HTML SHA-256 `0bf05a87365ca09a6a85114fe867995c4bfe0531a35adf61641454ed322e7696`). The live direct-vote research re-downloaded that exact original and verified both hashes and byte length again.

The original article directly names the senators with adjoining bill descriptions: **Benson** discusses access to individual class syllabi (SF 2666), **Gazelka** broader parental curriculum review/instructional materials (SF 2575), and **Chamberlain** protecting citizen contact information when speaking at school-board meetings (SF 2729). All three are **specific standalone issue links**; no wide omnibus inference is needed.

The archived publisher original also contains **four independently distinct, closed first-quoted policy passages** with a senator's named introduction and **issuer surname immediately after the closing quotation mark**:

| Senator | SHA-256 of first bounded original printed quote (no verbatim full-text copy retained) | Length | Named boundary present |
| --- | --- | ---: | --- |
| Justin Eichorn | `17449db698d3ccbcad420e653c040ef2d6a6d983bb48b8ffc2a9824003966f5e` | 96 | Yes |
| Michelle Benson | `3dbf76a78e179e8fa642185c6edcaac07ac985c1a96ee487c4f5165d956a5922` | 64 | Yes |
| Paul Gazelka | `b8995d111cb1492fc3cbedcdcdf31f064eee9268a99b92af71264e7ba7b8b739` | 101 | Yes |
| Roger Chamberlain | `2bfbc206218daf7ab0e0bf5e74f5b482626637fdb35e73ac10c551dd4eb2f11d` | 117 | Yes |

Eichorn's correctly owned quotation is documented but **does not become a fourth vote example**: there is no validated matching direct Senate final-passage roll for his separate proposal here. **One publisher URL** holds all four senators. The distinct March 7 archived publisher version was already authenticated in #1235; it was temporarily HTTP-unavailable in this focused replay and is **not counted as newly reauthenticated**.

Important timing distinction: Feb 14 at **23:24 UTC** is a *verified latest-by historic-original capture*, **not** the publisher's exact first posting minute. It safely predates the relevant March 3 and March 10 Senate passages. It does **not** prove the statement existed before a *same-day earlier Feb 14 hearing*. The complete later paragraphs of each senator's original quotation remain unapproved as a complete verbatim speech turn and no actual recorded voice/audio is authenticated.

## The three government bill texts themselves

| Official Revisor versioned text | Pages | Entire PDF bytes | Raw SHA-256 | Selected specific topic cues found |
| --- | ---: | ---: | --- | --- |
| [SF2575, version 0](https://www.revisor.mn.gov/bills/92/2022/0/SF/2575/versions/0/pdf/) | 1 | 211,399 | `a73c9ba43aa269fb7201299511e981c30bcde54203a9939a0fad46da6ec34648` | Yes |
| [SF2729, version 1](https://www.revisor.mn.gov/bills/92/2022/0/SF/2729/versions/1/pdf/) | 2 | 219,967 | `b537a8f8b1142066fff5a8b9516028478f9650ca2a8a8d701b1ae3d8afaf5a70` | Yes |
| [SF2666, version 1](https://www.revisor.mn.gov/bills/92/2022/0/SF/2666/versions/1/pdf/) | 2 | 221,128 | `746e101e83590fe85fe6374a2f4bf96d7b093586055b9724f9b648642dece4e1` | Yes |

All three current official Revisor **historical 92nd-session version PDFs** were downloaded, SHA-256 verified and read, with correct SF number and distinctive issue terms. The selected versions are the SF 2575 introduction, SF 2729 first engrossment and SF 2666 first engrossment. That substantiates the **policy-topic crosswalk**, not the independently archived posting minute of the exact same bill text. In particular **SF 2729 was amended during March 3 proceedings**; the checked first engrossment cannot be silently treated as a proven complete final floor-amended text snapshot.

## Disposition

**Three strong research source-before-standalone-personal-vote pairs; three official named Senate YES votes; four attributable first printed source quote segments; two original Journal PDFs; three government bill texts.** All belong to *one* previously discovered Feb 14 article—not three or four additional newly discovered publisher URLs. The official member vote evidence and dated article provenance are independent.

**Still zero production-grade automatic labels:** VotePredict's private retained source rows and as-of ingestion were not checked, exact historic bill-version posting minute or last floor amendments are not guaranteed, and no human has approved the entire full verbatim statement. No audio authenticates an oral speaker, and the different Feb 23 MPR Benson/Kunesh named program remains unresolved. These are excellent **candidate examples for a later controlled historical-evaluation cohort**, not permission to backfill model training silently.

Reproducible read-only checks: [source auditor](../../scripts/probe-senate-media-2022-standalone-parents-bills-primary.mjs), [10 synthetic/proxy/attribution adversarial tests](../../tests/senate-media-2022-standalone-parents-bills-primary.test.mjs), [real original SHA/member-vote regression tests](../../tests/senate-media-2022-standalone-parents-real-receipts.test.mjs), and [scoped existing-CI audit launcher](../../tests/senate-media-2022-standalone-primary-live-ci.test.ts). Initial [full CI/live original-source audit #38291698878](https://github.com/killjoy00/votepredict/actions/runs/38291698878) succeeded on source head `9fd8788a1672083d4fe65e02a004a1779e7d1343` with **2,863 tests passed, zero failed**. The [machine-readable first-party evidence receipts](senate-media-2022-sf2666-sf2575-sf2729-original-rolls-20261012.json) pin all source SHA-256 digests, vote identities, pages, quote bounds and holds. Final-head CI/replay required before merge.

No original full government PDF, article HTML, WARC, complete quote, audio or private source record is persisted. No database, evidence ingestion, production collector, stored vote row, schema, model, serving, forecast or deployment changed.