# Minnesota Senate 2021–2025 public media: three original newsroom speaker checks and four Reformer URL-pair hypotheses

Public research only, issue #987 and #946; no private vote, training, model features, forecasts, production media ingestion, or real recorded roll calls. All date and quote claims are confined to the exact public original publisher version actually reverified.

## Correcting an omitted historical reporter quotation

The original [15-article independent journalism source ledger](senate-media-2021-25-further-independent-reporting-15-leads.json) omitted **Roger Chamberlain** from the February 14, 2022 [Minnesota Reformer school-curriculum news conference](https://minnesotareformer.com/2022/02/14/senate-gop-bills-would-require-minnesota-teachers-to-disclose-curriculum-to-parents/). The Reformer reports Chamberlain's own direct question-response quote, separate from **Paul Gazelka** and **Michelle Benson**. The [Minnesota Legislative Reference Library member record](https://www.lrl.mn.gov/legdb/fulldetail?ID=15325) confirms Chamberlain was serving in the Senate in 2022 and chaired the Education Finance and Policy Committee. The named speaker candidate count is therefore corrected from **21 to 22** across the same 15 articles, with 2022 increased from 4 to 5. This changes *attributed current-publisher interview/news quote candidates only*, NOT historic original article URL totals or archived SHA proof. The reporter byline for the April 19, 2024 housing story is correctly **Madison McVan**, replacing the generic "Minnesota Reformer" credit.

Prior merged live archive run receipts accurately record what was retrieved at the time but their old description as 21 named speaker candidates was an incomplete speaker census. All 24 original historically verified independent newsroom *HTTP capture bodies across 12 exact article URLs* remain individually pinned and unchanged in the [historical independent original body receipts](senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json). There are still three unresolved selected publisher-original CDX URLs. A revision to speaker identification must never silently relabel the underlying article or mark a full quote as approved.

## Track A — now verify eight more separate senator quotation cues

The [eight-cue, three-article original reporter quote queue](senate-media-three-independent-newsroom-historical-multi-speaker-queue-20261011.json) deliberately uses two already SHA1+raw-SHA256 authentic ORIGINAL archived HTTP bodies each from:

| Current publisher dated article | Separately named serving senators | Authenticated original HTTP captures |
| --- | --- | --- |
| [Feb 14 2022 curriculum news conference](https://minnesotareformer.com/2022/02/14/senate-gop-bills-would-require-minnesota-teachers-to-disclose-curriculum-to-parents/) | Gazelka, Benson, **Chamberlain** | Feb 14 2022 22:22:10 UTC; Feb 15 2022 03:12:23 UTC |
| [Apr 19 2024 housing zoning report](https://minnesotareformer.com/2024/04/19/housing-bills-falling-off-legislative-agenda/) | Steve Drazkowski, Heather Gustafson, Lindsey Port | Apr 19 2024 12:52:13 UTC; Apr 19 2024 14:24:44 UTC |
| [Apr 25 2025 labor/federal cuts reporting](https://minnesotareformer.com/2025/04/25/minnesota-democrats-look-for-money-to-stave-off-federal-cuts-and-other-labor-news/) | Erin Maye Quade (two separate same-speaker cues) | Apr 25 2025 15:28:44 UTC; Apr 25 2025 15:29:28 UTC |

Each raw archive body must again match **original indexed SHA1 + previously pinned raw SHA256 + original byte length** before checking one brief normalized text fragment per independently reported senator and one optional same-paragraph speaker-name proximity clue. The eight short phrase cues over six archived original body versions produce **16 quote-presence checks**. That is 3 reporter articles, **seven distinct named senators**, NOT 16 separately verified full speaker utterances or a roll-call census. As a particularly important example, Drazkowski, Gustafson and Port are quoted as speaking/questions at committee proceedings as *reported by a newspaper*, which does **not** independently authenticate a recorded committee vote or video transcript.

Research CLI:

    node --import tsx scripts/audit-senate-media-three-reporter-original-quote-cues.ts --output artifacts/senate-media-three-reporter-original-quote-cues.json

## Track B — resolve four historical Reformer /briefs/ vs dated URL uncertainties only with source proof

Prior [31 public MPR/Reformer original URL ledger](senate-media-public-article-discovery-2021-25.json) proposed four potential pairs, but prior [19 successful indexed historical replay receipts](senate-media-2021-25-exact-public-replay-receipts-20261010.json) **never authenticated both historic original URL bodies within any pair**:

| Story/day | Short /briefs/ original URL | Dated-path original |
| --- | --- | --- |
| Public safety plan / March 22 2022 | Existing exact archived SHA1+SHA256 original body from Mar 25 2022 | CDX previously unavailable |
| Driver's licenses / Feb 21 2023 | Previously indexed Feb 27 replay SHA1 **MISMATCH**, not source-authenticated | CDX previously unavailable |
| Sanctuary proposal / Feb 12 2024 | Existing Feb12 SHA1+raw SHA256 original body | CDX previously unavailable |
| Road-signs amendment / May 1 2025 | Existing May1 SHA1+raw SHA256 original body | CDX previously unavailable |

See the [four exact 8-URL source hypotheses queue](senate-media-reformer-four-historical-brief-dated-alias-queue-20261011.json) and [bounded original CDX and Wayback audit](../../src/evidence/senate-media-reformer-four-original-url-alias-proof.ts). It independently queries exact original historical URLs on BOTH sides; at most 20 archival index rows (2021–25), two no-redirect 2.5MB bounded indexed SHA1 verified original HTML replays per URL, with observed raw SHA256 and optional original historic canonical link target and rendered page visible text fingerprint SHA256. Those fingerprints are metadata-only; no original news prose stored.

**Never merge articles automatically**, even if current URLs have the same title, share a slug, or each happens to serve matching text today. Historical content/canonical evidence is only a *signal* when actual original body bytes on BOTH distinct URL paths are confirmed. A missing CDX row, redirects, checksum mismatch or unverified original body are *unknown*, not proof of non-publication. A successful one-sided original canonical pointer is still not historical two-sided source identity. Original first posting clocks and exact full senator quotations are not authenticated by this alias test.

Research CLI:

    node --import tsx scripts/audit-senate-media-reformer-four-historic-alias-pairs.ts --output artifacts/senate-media-four-reformer-original-alias-pairs.json

## Public scope boundaries

Both public research tracks retain exact original URLs, archiving UTC, indexed SHA1, observed original SHA256 and body byte counts, bounded normalized short text cue flags and optional historical canonical URL strings. Full source HTML/audio is never persisted. Speaker-name proximity is a heuristic, not independently verified spoken words. No Minnesota senator's recorded floor or committee choices may be inferred from reporter coverage of bills, amendment action or collective statements. Historic archive capture date is NOT a publisher original first-posting clock. Continue keeping #987 and #946 OPEN and owner #912 CLOSED.

## Live public original research receipts — authenticated, not proposed

### Track A: historical short wording in 2022, 2024 and 2025 reporter articles

First [exact original newsroom speaker-cue run #38166031166](https://github.com/killjoy00/votepredict/actions/runs/38166031166) SUCCESS, historical source head `6ccc3ff4e75fa06b61dab07363dc4da0781d742c`. Downloaded artifact 11711912322: original ZIP SHA256 `3a8e9a6889ed9e4fdefa78f882c34df1ad45ea34f69c11fdca8fdaec75ec7777`, decoded 12,921-byte metadata JSON SHA256 `2010a9b6c2a1c1df2373fa84938d24586000a254fa95ac263964ccea7ac178a7`. **Five of six** exact original HTTP archived source versions independently reverified (indexed raw SHA1 and previous original-body SHA256/bytes). The earliest February 14 2022 curriculum source replay returned a **redirect**, so three cue checks were **UNKNOWN**, not missing words; the February 15 2022 archived publisher version SHA256 `d8ab6a048fff09ddbdb3c5968323fe4f5ee175727e34d9c6139941fa9920dae9` validated exactly and contained **three individually attributed Gazelka, Benson and Roger Chamberlain reporter quote fragments with their correct names in the same paragraphs**.

In the two April 19 2024 historical housing reporter HTML versions (SHA256 `15e0342c212e0a84cbb495a44d9d12e136e1639aef05b2604c7018d4acb71de5` and `6b68d142d279b268d4b19367c0c3a6e54b691c783367aa64ee5aaf685b887661`), all **Drazkowski, Gustafson and Port** separate short fragments were found; only Drazkowski's short phrase also shared an HTML paragraph with his full senator name, because the other two are last-name or previous-paragraph attributed. Two April 25 2025 *Reformer* body versions SHA256 `3a91a6e66be3296bdf4253c909ea145a82a2c629c55f1a190f54a97dd0010ca2` and `8e344277eeb6c9d30f17c40938e51057ce5b4d8948b399e48c601799ab014577` each contain both Maye Quade fragments; same-paragraph full speaker label only on the first fragment. Overall **13/13 checkable historical short text fragments FOUND, three unknown due to redirect, seven same-paragraph full-speaker-name clues**. See [per-version original raw SHA and source quote receipts](senate-media-three-reporter-original-historical-phrase-receipts-20261011.json). Name proximity is NOT final human quote approval; newspaper coverage of Senate questions or bill passages NOT independently recorded votes.

### Track B: historic Reformer /briefs/ URL evidence: 6 original versions, aliases still unproven

First [four exact public source URL pair research run #38166031062](https://github.com/killjoy00/votepredict/actions/runs/38166031062) SUCCESS on source head `6ccc3ff4e75fa06b61dab07363dc4da0781d742c`. Downloaded artifact 11712620545: ZIP SHA256 `2e077aadf360b4200de7c32f03bb89e2fa1bc845a0577176e27e6ddee64682f7`, decoded 14,225-byte JSON SHA256 `5efae7230f24ed73f3bef0e7f9c07bdbd9f15d59e31f9e3c6fe4976d72c47659`.

Exact historical CDX searches on **EIGHT distinct original publisher URL variants** returned indexed candidate captures for the FOUR `/briefs/` pages and **unavailable/invalid indices for ALL FOUR corresponding dated-path URLs**. The first two indexed original replay captures per brief yielded **six original indexed-SHA1-matching HTML source bodies and two historical digest mismatches**. The four historical brief page canonical links found in all six good captures each pointed to their **own `/briefs/` URL**, not to a dated-path alias. No pair had BOTH source URLs' historical original page bodies verified: **ZERO historical alias identities proven, ZERO automatic article deduplications**.

Important positive **new** source recovery: the earlier February 27 2023 `/briefs/` drivers'-license archived original SHA1 mismatch remains unresolved, but a *different* **March 3 2023 01:54:42Z genuine original HTML version** of that same `/briefs/` URL now matches original indexed SHA1 `NFGCH2C42JBLMVTQPDHIH53D5EW2STML`, raw original SHA256 `4a56cee75803573f44c08fc4aaeb4183ebf9476bbe1df5315bfd8e7eff6a484b`, 131,515 bytes. This is independent original source existence proof by March 3, NOT proof of original February 21 posting time, any senator's exact individual wording, or whether the dated-path equivalent published separate content. [Durable four-pair historical original SHA and index receipts](senate-media-reformer-four-historic-brief-dated-alias-receipts-20261011.json) preserve every indexed URL, capture, prior digest match, mismatch and unknown path.

### Third independent public 15-URL retry: 24-body / 12-article union remains

After correcting the original selected sample to **22 named senator speaker candidates**, [third independent 15-URL source audit #38166093719](https://github.com/killjoy00/votepredict/actions/runs/38166093719) succeeded (downloaded artifact ID 11712101954, ZIP SHA256 `0224f48b02db6d317204086de08e44641f06f543cee5e3794c23f66f0695f326`, decoded 33,597-byte JSON SHA256 `457f25b7e1dd1def5acaf9813cb296d0046c41279d2a02ed3e99c16100bddc28`). That run reproduced **22 previously SHA-matched original bodies**, no newly authenticated original capture, with four transient CDX failures including the already historically authenticated 2024 housing article. The entire first+second historical source discovery retains **24 SHA-consistent original HTML versions across 12 of 15 selected independent news articles**, three remaining non-indexed source leads: 2021 commissioner confirmation, 2022 special session, 2025 paid sick leave. Absence of CDX proof is never absence of the actual published news article. [15-original source union with third-run receipt](senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json).

All evidence still PUBLIC only, does not include authentic senator audio, publisher original first-post clocks, full speaker-quote human approvals, committee/floor member recorded-vote evidence or any VotePredict forecast/training/production ingestion information. Keep #987/#946 OPEN and #912 CLOSED.
