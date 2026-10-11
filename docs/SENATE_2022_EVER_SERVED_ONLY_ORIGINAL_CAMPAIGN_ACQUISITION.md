# Issue #864 — Date every source; research only people documented as Minnesota senators

This source-acquisition tranche is explicitly **senator-only**. The candidates below were confirmed through original Minnesota Legislative Reference Library (LRL) [Senate service records](https://www.lrl.mn.gov/legdb/senate_dir), not inferred solely from who appeared on a 2022 ballot. A person who served earlier or later remains eligible for historic candidate research even if the specific election lost. Anyone who never served is **out of scope**, and the runner fails closed if any of its proposed targets cannot independently match a Senate service record. It does not research defeated non-senators or expose them in the senator-facing output.

## Five precisely bounded sites, only four actual senators

| Historically served senator | 2022 Senate district | Campaign-hosted source target(s) | Evidence caution |
| --- | --- | --- | --- |
| Carla Nelson | 24 | [carlanelson.com/home-page/](https://www.carlanelson.com/home-page/); [home-page-2/](https://www.carlanelson.com/home-page-2/) | Modern site claims about its 2022 campaign are NOT independently dated 2022 text |
| Nicole Mitchell | 47 | [2022 candidacy announcement](https://www.nicolemitchell.org/news-events/today-nicole-mitchell-confirmed-her-candidacy-in-the-new-senate-district-47-which-includes-woodbury-and-part-of-maplewood) | Claimed February 2022 press release date remains a publication claim until older bytes corroborate it |
| Rob Kupec | 4 | [kupec4mnsenate.com/our-campaign](https://www.kupec4mnsenate.com/our-campaign) | Current live page may include updates after the election |
| Michael Kreun | 32 | [michaelformnsenate.com](https://www.michaelformnsenate.com/) | Modern site also promotes 2026; no new text may be silently assigned to 2022 |

The independently acquired official source is the original LRL Senate service directory HTML, SHA-256 hash and actual UTC retrieval timestamp downloaded in [successful #953 source run 38094976711](https://github.com/killjoy00/votepredict/actions/runs/38094976711), artifact ID **11685387674**, named \`senate-2021-25-ever-served-only-source-coverage-v2\`. The new runner **rehashes those original bytes and checks the stored UTC observation timestamp before making even one campaign site request**; it then requires exact person + Senate district + service extending into the term following 2022. It accepts an LRL-declared nickname ("Rob" Kupec) when explicitly listed; it is not general fuzzy matching.

## Strictly dated source record types

Each of the **five current campaign page GETs**, five exact historical Wayback index GETs, 15 Common Crawl 2022 index GETs, any historical snapshot replay and original WARC HTTP 206 download includes **the actual request time and completed observation time in UTC**, current page body SHA-256/length/status or error, and selected HTTP Date/Last-Modified/Memento headers. Even an HTTP error is dated. Today/current retrieval is a **minimum attested observation date** for the returned 2026 webpage body; it never proves the same words existed in 2022.

For a specifically matched historical capture, **2022 content gets a date only through original bytes**, not index claims:
- Wayback CDX: exact original URL and pathname, response HTTP 200 and the original HTML response SHA-1 Base32 matching the independently fetched CDX row. Query bounds Jan 1 to Nov 7, 2022 and never includes the Nov 8 election date.
- Common Crawl: real \`CC-MAIN-2022-21\`, \`...-33\` or \`...-40\` index rows containing the exact candidate URL/path; then HTTP **206** plus validated byte Content-Range, gzip CRC, original WARC response target and timestamp, embedded HTTP 200 body, both WARC block and original page SHA-1 digests matching the separate index. At most **five** bounded WARC range downloads.
- All archive data is **strictly earlier than 2022-11-08 00:00 UTC**; the recorded timestamp is the *latest point by which the exact archived page bytes were observed* (historical capture). It is **not the unknown original author posting timestamp**. Candidate-specific policy excerpt attribution to a particular statement requires a further original-page text audit; even a genuine website capture alone does not authorize a forecast feature.

The exact source manifest records \`currentPageRetrievedAtUtc\`, \`earliestVerifiedOriginalPageCaptureByUtc\`, \`earliestVerifiedOriginalPolicyStatementPublicBy\` (null until independently checked) and \`originalPageFirstAuthorPublicationDate\` (null until proven), preserving each distinction. Failed archive GETs or index searches produce an actual-dated failure report, **not zero historic captures or proof a candidate never had a site**. No field is backdated to an advertised article title, ballot date or URL year. Source discoveries from mutable 2026 pages are labeled accordingly.

## Execution and safety

A single internal PR runs \`.github/workflows/acquire-2022-ever-served-senate-campaign-pages.yml\` without secrets. It downloads only the earlier verified **public** LRL source artifact, never a database, and executes:

\`\`\`bash
node --import tsx scripts/run-senate-2022-ever-served-campaign-originals.ts \
  --lrl-original /sources/mn-lrl-official-senate-service-directory.html \
  --lrl-metadata /sources/mn-lrl-official-senate-service-directory-audit.json \
  --output-dir /new/senate-2022-historical-original-source-run
\`\`\`

The directory must not already exist; source response files and JSON manifests use exclusive \`0600\`, bounded size/time and an HTTPS host/path allowlist. A 30-day Actions artifact preserves actual public source bytes for audit, not source/evidence table changes. No email, office outreach, Neon, Vercel, scheduler, deployed model, forecast, or automatic evidence insertion.

## Remaining #864 acceptance after acquisition

Original 2020 and 2022 SOS **filing exports** with the historical campaign website field; older issue pages for other actual Senate members; the complete historical 2021–2025 membership service chronology and separate production data binding; and a defensible statement-by-statement historical public-by audit still need work. In particular, a 2026 retrieved page is not an admissible 2022 predictor—even though we now have a precise 2026 observation time for its current text.

Issue [#864](https://github.com/killjoy00/votepredict/issues/864) stays **OPEN**.
