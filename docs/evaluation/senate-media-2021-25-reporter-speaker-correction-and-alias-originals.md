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
