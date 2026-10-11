# Track D: public first-person Senate media remarks, exact historical archive proof

**Scope: public source history only.** Issues #987/#946, 2021–2025. No private VotePredict source rows, database, credentials, recorded-vote inference, production news seeds, collection, models or predictions.

## Which previously found material is being rechecked?

[Previous separate firsthand-media source discovery](senate-media-2021-25-public-firsthand-remarks-discovery.json) has **18 non-exhaustive, currently publicly accessible original-publisher URL leads**: four dated in 2021, three in 2022, four in 2023, three in 2024 and four in 2025. There are 16 named-senator individual speech *candidates* on the currently served pages (13 distinct senators) and **two collective statements** which cannot be turned into individual direct quotations.

This is **separate from the original 31-URL MPR/Reformer research sample**, its 19 indexed-SHA-1-consistent original Wayback replay body receipts, 11 unverified/failed CDX requests and one CDX digest mismatch. Do not silently combine them into a complete publisher or statewide corpus.

The next step is independent **historical original capture** proof for the 18 new pages: exact URL, archive UTC, indexed payload digest, raw actual archive response digest and observed SHA-256. Current URLs, current text and publisher-displayed dates alone do not do that.

## Safe, bounded historical Wayback workflow

Use [Senate media first-person remarks public exact Wayback proof](../../.github/workflows/senate-media-new-public-remarks-wayback.yml). This **public-only** workflow is triggered by manual main-branch dispatch after merge, or solely the named isolated owner-branch PR while under development. It uses no credentials beyond contents-read GitHub permission, does not connect to any database, and writes **metadata only** to a seven-day public artifact.

An equivalent local checkout invocation is:

    node --import tsx scripts/probe-senate-media-new-public-remarks-wayback.ts --scope all --replay-count 2 --output artifacts/senate-media-new-remarks-public-wayback.json

For manual dispatch choose scope pilot (six URLs) or all (18 URLs), and replay_count 0, 1 or 2. The pilot includes Julia Coleman 2021, Jeremy Miller 2021 original MPR, John Marty 2021 caucus statement, the 2023 collective POCI statement, John Marty 2024 sports betting and Karin Housley 2025 bonding.

The probe accepts **only exact checked-in 18 original public URLs**. Each URL must match the expected publisher and one of four HTTPS hosts: senatedfl.mn, www.mnsenaterepublicans.com, www.enterpriseminnesota.org, or www.mprnews.org. Arbitrary URLs, parameters, external hosts, duplicate leads, historical dates outside 2021–2025 and already-claimed quote approvals are rejected **before network calls**.

Each URL uses at most **one CDX request, 20 indexed rows, 96KB of CDX JSON and 2 exact original id_ replay GETs**. Preserve distinct 14-digit capture UTCs even if indexed SHA-1 is the same; never use CDX digest-collapse. Raw original responses are at most 2.5MB, streaming bounded. Accept only an exact indexed 200 original article content type, identical original URL and matching indexed base32 payload SHA-1 before emitting the **observed** SHA-256 and byte length. Concurrency 2, per-response timeout 20 seconds, overall workflow timeout 18 minutes. No raw HTML, audio, snippets or private data is written to artifact, logs or source control.

**Interpret results cautiously:**

- **index_candidates:** the CDX index contains a candidate; source bytes still unverified until exact replay digest consistency.
- **index_empty:** empty in one bounded exact-CDX query only. Never infer no historical article or speech.
- **index_failed:** a public API, network, format or non-article check failed. Its historical publication status is **unknown**.
- **matched_indexed_payload_sha1:** an original archived page's body digest matched its CDX indexed digest and SHA-256 was observed. That specific body version existed by capture UTC. It does not certify first publication clock, original audio, an exact human quotation, its relevance to a particular issue or historical prediction availability at any earlier cutoff.
- **cdx_payload_sha1_mismatch, redirect, HTTP denial, MIME mismatch, byte cap:** leave the original body **unverified**, never turn into proof of missing publication or a different senator statement.

No first-party senator voice, individual stance, initially posted-by timestamp, original audio, private database source match or legislative vote is certified by this tool. In particular MPR transcripts can be added after radio broadcast; an archived HTML transcript is not original audio authentication.

## Attribution pitfalls to preserve during review

**2021 Miller three-source chain:** Nov 8 Enterprise Minnesota Q&A, Nov 15 MPR Morning Edition Miller interview, and Nov 16 John Marty DFL release responding to Miller are three different publisher sources. Marty quotes or paraphrases Miller secondhand, but his own full statement is a separate, direct senator speech candidate. Do not transfer any wording among the three without exact original-version proof.

**2021 Coleman:** her March 29 caucus statement has directly attributed Coleman words while David Senjem is named in a contextual bill-author role. No Senjem quote is established by this page.

**2023 POCI and 2025 Rochester:** an entire caucus or mixed Senate/House collective statement, even with ten senators listed, does not establish ten individually spoken first-person remarks. In the Rochester text, House representatives are not Senate members.

**2024 Marty:** his sports betting page shows Jan 24 and Jan 26 on its current version. That ambiguity is not proof of the original publication chronology until older captures are inspected.

**2025 Doron Clark:** a Senate member only on/after the official Feb 3 oath; pre-oath campaign quotations cannot be backdated as remarks by a serving state senator.

## After actual original proof is recovered

Save source run provenance, artifact and decoded JSON SHA-256 and exact matching body hashes in a permanent **public metadata-only** receipt, after independently checking the source run and artifact. Then re-fetch a narrowly chosen original page version by exact timestamp and SHA-256 to check short passages in **visible original text only**; a string match is a cue for separate human senator identity, speaker and timing verification, not automatic approval.

The remaining media universe is unknown. Build an evidence queue by individual serving senator and year across original interviews, caucus and personal campaign pages, original news quotations, archived social posts and other publishers, without inventing a statewide denominator or treating gaps in these 18 leads as article absence.


## Actual first all-18 public source run and durable SHA metadata

The full original live [public Actions run #38156337828](https://github.com/killjoy00/votepredict/actions/runs/38156337828) on research source-head **1e4368694a6da57b59bc33296e425d408619a973** produced a seven-day metadata-only artifact **11708690733**. Its ZIP SHA-256 **a204368dab2c8b68823eb3661cb32d04d77890bfc34c1a423e4acb14d8f16523** and exact decoded 38,745-byte JSON SHA-256 **4b65981dbb3ca9424af4947d986b9a3b0eae8307efc9490b722025a49b82720f** were independently rechecked against the actual downloaded artifact. All source records and original SHA receipts are now preserved in the [permanent, public metadata-only receipt manifest](senate-media-2021-25-new-public-original-replay-receipts-20261011.json). The initially tested source head differs from the final PR head because of a TypeScript-only strict callback annotation; no archive-source bytes or historical data were modified.

**Observed actual bounded sample:** 18 exact selected URLs, **13 indexed URL candidates**, **5 unavailable/unverifiable index responses**, no CDX-empty result, 26 exact original replay attempts. **23 replayed HTML bodies from 13 distinct URLs matched their CDX indexed SHA-1**, yielding true observed raw HTTP body SHA-256 hashes and byte counts. Three other replay attempts are held out: **two SHA-1 mismatches** and **one redirect refused**. These are **not** a count of three additional missing articles. Zero human-approved senator quotes or authenticated original audio, initial publisher clocks and forecast cutoffs.

| Year displayed on current page | URLs sampled | URLs with at least one digest-consistent historical HTML body |
| --- | ---: | ---: |
| 2021 | 4 | 4 |
| 2022 | 3 | 2 |
| 2023 | 4 | 3 |
| 2024 | 3 | 2 |
| 2025 | 4 | 2 |
| **Sample total** | **18** | **13** |

**Strongest original-version research targets:**

- **2021-11-15 MPR Jeremy Miller** original captured 21:55:12Z and 23:26:33Z, **identical** 91,141-byte original HTTP HTML body SHA-256 **a5dde038ca7558d8ed8209e57721443e84b569c7e0c7b4eb627be38265a730bf**. The snapshot existed on the article's presently displayed day, but the separate Nov 16 Marty paraphrase of a Miller statement is not automatically authenticated by the MPR page. Original audio and wording remain to be compared.
- **2021-11-16 John Marty original caucus page** captured at **22:45:21Z**, 80,205 bytes, SHA-256 **83d21412e1ba4b94b008169e8a9c4018a6b88a23de665c930abf2a6c3e22fa98**. **2021-04-13 Coleman** captured 88,680-byte original body SHA-256 **14b5aad174248d5cc693ccd2c7c1f23c7bbf096b625a11f500539fcc4ba53a77**. Exact short senator words still require inspection of these captured versions.
- **2022 Kunesh** first observed archived on Jan 21, **2023 Johnson** first observed on Feb 3, **2024 Marty online-sports-betting** first observed on March 2, and **2025 Housley bonding** first observed on April 5. These capture times are not automatic publisher display-date proof or speech approval.
- **2023 POCI collective statement** had an early indexed replay redirect, and a separate verified 2023-12-07 original page body. The later verified page does **not** turn the quoted text into ten individual senator statements.
- **2025 Rochester collective statement** had a 2025-05-02 replay digest mismatch but a later verified 2025-09-04 page, not a first-original-date claim.
- **Index unresolved (5):** Gary Dahms 2022, Eric Pratt 2023, Karin Housley 2024 session procedure, Doron Clark 2025 oath and Susan Pha 2025. An index failure does not establish absence of the corresponding historical publisher page or senator statement.

**Important interpretation:** all quoted 23 numbers refer to **separate captured original HTTP body versions**, not individual claims/quotes or even 23 unique articles. Two different captures may have identical original bodies, as seen with MPR Miller. These 18 URLs remain a curated sample of two caucus domains, MPR and Enterprise Minnesota, and leave the statewide senator-by-year media statement universe unknown.


### Independent source recheck — one additional exact original body verified

A second actual [public source run #38156433947](https://github.com/killjoy00/votepredict/actions/runs/38156433947), at the TypeScript-corrected source head **ede2942e84d3a971fd77ebf99f73a80d6f12b07a**, succeeded. The independently downloaded second ZIP SHA-256 was **38bd36791bca959bfcf07d692e240e3ec7d5035ef24678ed22b3c4d69109caa7**; decoded JSON SHA-256 was **74482667f6cc7bb7c065b32a66dad7dd86e67c9561669b1767aa6c480ee4c47c**.

The recheck reproduced **all 23 common exact captured bodies with identical SHA-256 and byte count**. In addition, the original June 5, 2023 POCI collective caucus page, which had returned a **transient redirect hold** in the first live run, replayed with an exact consistent CDX SHA-1, 116,116 original bytes and observed SHA-256 **307d379de103fcbcda05a1c52d35989121b442dd8783288027b01843ff1b997b**.

Therefore the union is **24 independently SHA-consistent captured original HTTP bodies across the same 13 distinct URLs**. The first run's earlier redirect remains honestly recorded, not erased; its resolution in the second run demonstrates why archive replays and index errors must not be treated as historical absence. The POCI body remains a **collective statement**, not a set of authenticated individual senators' words. All human speaker, original audio and publisher first-posting-time conclusions are still unknown.
