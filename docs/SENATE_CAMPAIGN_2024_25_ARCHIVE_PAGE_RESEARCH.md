# #864 C — campaign issue-page URL recovery and pre-election archive retrieval plan (2024–25)

This follows the merged election-identity source work in #911, #917 and #918. **This tranche improves real URL/path discovery and makes archival lookup reproducible**; it does not invent Wayback captures, archived page text or historical senator positions when the source cannot be obtained.

## What was recovered from a pinned third-party later crawl

A public research repository, \`nniiicc/electionsitechange\`, contains original target campaign website URLs, crawl-extracted page text and metadata. We inspected **exact** \`meta.json\` and \`text.md\` files at GitHub commit \`888e15a64c67d221de427aac49dc82ddc11a0c84\` (committer date **2026-10-10T17:33:17Z**) and pinned per-file Git blob SHA-1 hashes and crawler fingerprints. **This source is dated a full year AFTER the target 2024/2025 elections.** Its blobs authenticate the *third-party Git copy only*, not the original website bytes or any original 2024/2025 posting time.

New ledger: \`data/evaluation/senate-campaign-issue-page-url-leads-2024-25-v1.json\`. It contains **six publisher-linked campaign domains**, **five later-crawl homepages**, **four exact issue/policy page URL leads** and one still-unresolved original-site root (Dwight Dorau).

| Candidate / election | Precise issue page path from research copy | Policy research target | Historical archive proof |
| --- | --- | --- | --- |
| Ann Johnson Stewart / 2024 SD45 | \`https://annjohnsonstewart.com/priorities/\` | historical issue page versions before Aug 13 primary, Nov 5 general | **Not recovered** |
| Keri Heintzeman / 2025 SD6 | \`https://heintzemanforsenate.com/\` | homepage *contains issue text in 2026 copy*; find earlier homepage versions | **Not recovered** |
| Michael Holmstrom Jr / 2025 SD29 | \`https://www.mike4mnsenate.com/platform\` | platform page versions before Aug 26 primary, Nov 4 general | **Not recovered** |
| Louis McNutt / 2025 SD29 | \`https://louismcnuttformnsenate.com/issues\` | issue page versions before primary and general | **Not recovered** |
| Amanda Hemmingsen-Jaeger / 2025 SD47 | \`https://amandaformn.com/issues/\` | issue page versions before primary and general | **Not recovered** |
| Dwight Dorau / 2025 SD47 | root \`https://votefordwight.com/\` from prior dated publication | page paths and original archive unverified | **Not recovered** |

These candidate-domain names match the six preexisting, explicitly **publisher-sourced** website leads in \`senate-sos-campaign-website-seeds-2021-25-v1.json\`. They have **not** been independently matched to original SOS website fields from official historic filing-export bytes. Ann Johnson Stewart had multiple campaigns and districts (2020 SD44 and 2024 SD45); the **2024 SD45 website text is never assumed to have existed during the 2020 SD44 campaign**.

Significant failure to avoid: the 2026 copy of Ann's site homepage references 2026; the 2026 copy of Keri's site also references 2026. Michael's later-crawled platform metadata references 2024, but a *date written in page text* cannot establish its publication date. It would be unsafe to load those live/later-crawl paragraphs as 2024/2025 historical evidence. The source ledger records those mentioned years **as untrusted page-content metadata only**.

## Archive discovery, using an actual issue URL rather than just a campaign homepage

Run from the repository root with **no production database credentials and no outbound network calls**:

\`\`\`bash
node --import tsx scripts/plan-senate-campaign-archive-source-recovery-offline.ts \
  --output /tmp/senate-2024-25-archive-queries.json
\`\`\`

This generates **16 concrete CDX requests**: one campaign host prefix query and one exact homepage query for each of six domains, plus one exact policy page query for each of the four recovered policy paths. Every query has its candidate identity, domain, episode, primary/general dates, a bounded \`limit=400\`, 2024 start date and a conservative **prior-day** end date (no election-day or later snapshots). Query output requests \`timestamp,original,mimetype,statuscode,digest,length\`, \`statuscode:200\`, **without \`collapse=digest\`**, so source versions aren't discarded before the offline v3/version-aware comparison.

| Election episode | Cutoff for *general* pre-vote source discovery | Separate earlier primary cutoff |
| --- | --- | --- |
| 2024 SD45 | 2024-11-04 23:59:59 UTC | strictly before 2024-08-13 |
| 2025 SD6 | 2025-04-28 23:59:59 UTC | strictly before 2025-04-15 |
| 2025 SD29/SD47 | 2025-11-03 23:59:59 UTC | strictly before 2025-08-26 |

No new archive pages are claimed to exist merely because these query URLs are generated. At the time of this research, direct Wayback CDX/archive retrieval through the available browsing interface failed; treat this as **archive-service access not verified**, NOT "zero historic captures" and NOT proof that the campaign never published an issue page.

## Optional inspection of independently acquired CDX index exports

Once the JSON CDX responses are separately obtained, create a local JSON file shaped as:

\`\`\`json
{
  "schema": "campaign-archive-offline-cdx-index-v1",
  "results": [
    {
      "queryId": "COPY_AN_ID_FROM_THE_GENERATED_REPORT",
      "status": "complete",
      "sourceResponseBytesAuthenticated": false,
      "rows": [
        ["timestamp", "original", "mimetype", "statuscode", "digest", "length"]
      ]
    }
  ]
}
\`\`\`

Populate each \`rows\` array with the **actual previously exported response** for that query. Failed calls should be \`"status":"failed","rows":null\`, never an invented empty successful response. Then:

\`\`\`bash
node --import tsx scripts/plan-senate-campaign-archive-source-recovery-offline.ts \
  --cdx-export /path/to/real-CDX-results.json \
  --output /tmp/senate-2024-25-cdx-version-review.json
\`\`\`

This cross-checks response identity against the expected candidate host and exact requested path, validates real calendar timestamps, excludes election-day and after-election captures, independently splits **pre-primary** and **pre-general** candidates, deduplicates repeated index rows, and runs the merged #906 version-preserving selection (40 slots per candidate; digest-change candidates are not automatically substantive edits). Queries still missing or failing remain explicit; hitting a 400-row limit is a potential completeness gap.

**Even a plausible CDX hit is only *unverified index metadata*.** It does not prove original captured response bytes, text excerpt, candidate attribution, original page integrity, or later platform edit history. Every resulting suggested URL has \`originalArchiveResponseBytesVerified=false\` and \`historicalForecastEligible=false\`. No source response hashes, statement excerpts, database IDs or new forecast evidence are fabricated.

To advance a candidate statement, separately fetch original *actual* \`id_\` archived response bytes for the precise timestamp and URL, verify response origin and status, compute SHA-256 of the bytes and page text, inspect version differences, confirm who authored the statement and identify the exact timestamp **the words** are first attested to. Feed verified source/statement inputs through #902, then obtain an authorized read-only database reconciliation and enforce historical forecast cutoffs. Direct Wayback original bytes may be unavailable; explicitly keep such candidates unresolved rather than backdate or promote them.

## Independent contemporaneous hints — separate from the original website

Two additional sources are useful for targeted manual checking but **not evidence of original campaign-site archive text**:
- [Minneapolis Labor Review, August 12, 2024](https://minneapolisunions.org/news/ann-johnson-stewart-labor-endorsed-SD-45) includes first-person interview remarks attributed to Ann Johnson Stewart about unions, civil engineering, infrastructure and local bonding; this is a **media/interview quote lead**, not an authenticated historic archived copy of her \`/priorities/\` page. The on-page date is not independently verified as a public-by timestamp here.
- [Lakes Area Vote's 2025 special-election questionnaire](https://lakesarea.vote/keri-heintzeman/) includes detailed candidate-supplied responses on the budget, government accountability and school performance and says the questionnaire was collected April 1–4, 2025. Its page currently lacks an **independently proven historical publication/capture date**, so the answers remain **candidate-response research leads**, not forecasts or inferred pre-vote public statements.

Neither interview page nor questionnaire authorizes treating an opponent's statement as the eventual senator's, or equating a modern crawl with a 2024 or 2025 pre-vote archive.

## Alternate discovery if Wayback is inaccessible

The [Common Crawl index registry](https://index.commoncrawl.org/collinfo.json) publishes month-specific indexes from **2024** and **2025**. Search actual URL/page paths in the appropriate indexes as an alternative, but verify **record-level timestamps and original WARC bytes**; publication/index window alone cannot establish content pre-vote. For 2024 SD45, August/October 2024 indexes are potential targets; for 2025 SD6, March 2025 or early/mid-April captures; for SD29/SD47, August and October 2025 indexes. A missing Common Crawl result would not certify absence of the website, and this tranche does not claim to have successfully queried those indexes for candidate captures.

## Remaining completeness debt

1. Recover actual independent pre-primary/pre-general Wayback or Common Crawl original responses, hashes and text versions for the four exact issue URLs and Keri's issue-bearing root.
2. Find original source page paths for Dwight Dorau, and recover 2020–22 equivalent campaign websites; 2024–25 source leads do **not** close the 2021–25 statewide cohort.
3. Recover historic official SOS filing-site exports and verify each domain/campaign year, original publication/crawl timing and redirect/host ownership against the candidate identity.
4. With **separate authorization**, obtain the SELECT-only membership/evidence report, generate named zero-campaign-site-issue position audits, and reconcile to stored source IDs. No Neon/Vercel reads/writes were made in this PR.
5. Leave [issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN until historical corpus denominator, original-page versions, exact statements and authorized DB reconciliation are fully proved.

**No production collector, scheduler, serving/model/forecast or frozen evaluation change.**
