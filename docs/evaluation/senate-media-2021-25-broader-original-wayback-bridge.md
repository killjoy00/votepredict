# PUBLIC 25-page original media discovery → historical archive evidence bridge

**Track D #987/#946. Research only, public original publisher pages and public Wayback HTTP bodies.** No private VotePredict source documents, production media seeds, member vote data, models or training. Work on the [previously merged 25-page source-discovery list](senate-media-2021-25-public-broader-source-discovery.json) (five displayed-publisher-year pages each for 2021–2025).

## What connects now, and what cannot be concluded

The old selected 31 MPR/Reformer pages, 18 Senate caucus/interview original-page leads and these **25 new exact publisher URLs** are distinct *curated samples*, not a complete Minnesota senator-year news census. The previous 18-source original replay work recovered 24 exact historical HTML versions across 13 URLs; the separate original HTML phrase audit rechecked six of them, finding six of seven short cues. The **25 newer URLs have not yet been historically verified at all** in that prior work.

The [bounded 25-URL public Wayback tool](../../src/evidence/senate-media-broader-original-wayback.ts) and [metadata-only action](../../.github/workflows/senate-media-25-original-wayback.yml) now bridge this gap. They do not amend the original 31/18 sample workflows or any application evidence tables.

### One exact public original URL → one bounded index → optional original body SHA

- Require **exactly 25 ledger leads** with **five per displayed year**, two named/counted speaker-labels only on the original 2022 Bigham/Eken page, explicit holds for three unlabeled/mixed-chamber collective statements, official legislator-history URLs, publisher domain pairings and all negative historic-proof flags unchanged.
- Restrict original URLs to **HTTPS senatedfl.mn, www.mnsenaterepublicans.com, minnesotareformer.com**. No redirect following, query parameters, userinfo or external host aliases. Never ingest discovered links from webpage HTML.
- For each selected URL, make exactly one **2021–2025 CDX index exact-match request**, up to **20 dated entries** and **100KB** response (do not collapse same-digest distinct capture times), then at most **two earliest exact timestamped raw `id_` Wayback replays**, each up to **2.5MB** with HTTP timeout and concurrency limits.
- Reject mismatched original URL/index response status/MIME/digest, redirects, denied archives, too-short/oversized responses, changed SHA-1 replay payload or any other uncertainty. Only an actual **byte-for-byte CDX indexed SHA-1 consistent original HTTP body** produces an observed *raw original* SHA-256, body byte length and original archived capture UTC.
- Output a **metadata-only seven-day research artifact** with all **25** index statuses, up to two capture replay statuses and original SHA receipts; never upload full archived HTML/audio, private data, senator quote paragraphs, or any allegedly verified votes. Persist real SHA manifests in a separate review step once exact public workflow run and artifact are inspected.

The priority pilot focuses on **Karla Bigham and Kent Eken's January 31, 2022 separately labeled Senate DFL release; Ann Rest's April 26, 2023 independent Minnesota Reformer reporting; Patricia Torres Ray's November 2021 statement; Jen McEwen's 2024 page; and Doron Clark's 2025 page**. The PR branch workflow uses **all 25** and two replay attempts to produce broad selected sample coverage, while an owner can dispatch the pilot/full research on main.

### Quote-specific review gate after original SHA verification

Current publisher material confirms the January 31, 2022 Senate DFL page presents distinct quotation paragraphs attributed to **Sen. Karla Bigham** and **Sen. Kent Eken**. That is **two speaker turns in one publisher article**, not a collective quotation and not two source documents. Original *Minnesota Reformer* April 26, 2023 reporting by Michelle Griffith quotes **Sen. Ann Rest** directly multiple times; **Sen. Matt Klein is named in a photo caption** and other state legislators are contextual persons, not automatically separate quoted senators. Rest's reported expectation about caucus support is a **reported quotation**, not proof that a recorded roll call actually occurred or that all colleagues voted that way.

Once original archived SHA receipts are obtained: request the **exact successful archived original URLs**, re-check their actual raw body SHA-256 and CDX indexed SHA-1, then check **short minimal phrases** separately under each original and named speaker. A text presence result is narrower than actual audio authentication or independent human speaker approval. Do not backdate any currently visible page phrase to its displayed publication date merely because a later Wayback original version contains that phrase.

**Three collective holds remain absolute even if their archived HTML is recovered**: 2023 Senate-and-House Blandin strike statement, 2024 Senate-and-House Inclusive Democracy Caucus statement, and the unassigned 2025 Senate Republican caucus release. An archived group statement never becomes an independently spoken statement by each listed member.

No statewide denominator can be calculated from either these 25 new leads or 31+18 earlier selected sources; missing/denied CDX results are **unknown historical original retrievals**, not missing historical articles or missing senator statements.

Run the public-only probe on a local checkout:

    node --import tsx scripts/probe-senate-media-25-original-wayback.ts --scope all --replay-count 2 --output artifacts/senate-media-25-original-public-proof.json

Required quality gate: exact final PR-head full CI (clean migrations, tests, typecheck, build, production dependency audit), actual public archive workflow success, independent public metadata-artifact verification and durable historical receipt before squash merge. Keep public research issues #987 and #946 open and owner-closed #912 closed.


## Actual public original source and historical Rest speaker-fragment results

### Selected 25 new public sources

First full [public Wayback 25 URL run #38159765437](https://github.com/killjoy00/votepredict/actions/runs/38159765437) succeeded on head bc2fc32c1b6a7e710cc146aa9d499c75351dc63c. Independently downloaded original artifact 11709539809: ZIP SHA256 954373dc073e744ee0742e54845bca571c6a7e9ce1a79266d6bc47c1086734bd, decoded 39,109-byte JSON SHA256 f9afab3aefa67b94342fdf9bc6f4bfee894820ddc491ae6aec69423012adf2fb. The [permanent 16 original HTTP body SHA256 receipts](senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json) include all 25 statuses, first-page indexed candidates, replay holds and tests.

The bounded result: 25 selected exact original URLs; 12 URL index candidates, 13 CDX unavailable/invalid indexes (UNKNOWN), zero index-empty; 19 archived HTTP replay attempts; **16 original HTTP bodies from 11 distinct exact source URLs passed raw CDX SHA1**, producing observed original SHA256 and byte length. Three other replays are not certified: a 2022 Duckworth response too short, a second 2024 Hawj fetch failure, and one 2025 Republican collective statement replay digest mismatch. A later 2025 collective version DID pass.

| Displayed year | New source URL leads | URLs with independently authenticated archived body |
| --- | ---: | ---: |
| 2021 | 5 | 1 |
| 2022 | 5 | 1 |
| 2023 | 5 | 3 |
| 2024 | 5 | 4 |
| 2025 | 5 | 2 |
| **Selected sample** | **25** | **11** |

These are selected URL observations only, not a Minnesota publisher-wide or senator-year coverage denominator. Unavailable CDX is not proof that an original publication was missing.

**Bigham/Eken January 31, 2022** remains CDX-index unavailable in this first source run. The current publisher page has TWO separately named senator quote turns within one page, but *neither archived historical quote has been validated yet*. Keep both on a targeted public original retry queue, never treat the index error as a missing article.

### Ann Rest original reporter-quoted language

[Public Rest exact-original study #38160243938](https://github.com/killjoy00/votepredict/actions/runs/38160243938) succeeded at head 720a7a64adab85cd8e72142519c396b7e079bab9. The independently downloaded artifact 11709863945 has ZIP SHA256 8c748013214c2175622ed2378463ebac799fd5292a79a07822fa5082bca94435; decoded 4,201-byte JSON SHA256 c7a0241699b20e2265ad49929448e3f28b02ab104b8b2423cdeedbaada31be44. Both exact prior original archived HTML bodies were re-fetched and **passed the indexed CDX SHA1, raw archived SHA256, and original byte-length checks**:

- April 27 2023 at 00:52:03Z: 140,253 original bytes, SHA256 3e8b662519a0a5db015f6820d8c4041229d628e487c944d987b31677a58662d7. That UTC instant was the evening of April 26 in Minnesota.
- December 3 2023 at 13:07:09Z: 137,489 original bytes, SHA256 8cfc8583d72c960866a06dc03d1926252ef19531055e30279e21ec3567c4b056.

In BOTH authenticated historical bodies, TWO separate short Ann Rest-reported tax policy fragments were present in normalized visible HTML, and a Rest attribution label was found within the same paragraph. **4 of 4 original-version phrase cues present, 4 of 4 same-paragraph Rest speaker-label cues.** The reporter's quote forecasting 34 DFL caucus votes does not prove that a particular senator cast a recorded floor vote. Same-paragraph attribution is a narrower source-text cue, not human-approved speaker/audiotape authentication.

The [durable Rest two-version historical speaker cue receipts](senate-media-rest-2023-exact-public-historical-html-quote-receipts-20261011.json) and tests pin actual results without storing original article HTML/audio. No original speech audio was authenticated; no quote was manually approved; no original publisher posting-clock precision was proven.

The source-specific public research command is:

    node --import tsx scripts/audit-senate-media-rest-2023-original-phrases.ts --output artifacts/senate-media-rest-2023-original-phrase-proof.json

Maintain source distinctions: Rest's direct quotation, House or Senate members mentioned contextually, Senate DFL group statements and actual recorded floor votes are NOT interchangeable. Keep #987/#946 open, #912 owner-closed.
