# Issue #864: broad original 2022 campaign archive recovery for actual Minnesota senators

## Reason for this targeted source acquisition

[PR #973](https://github.com/killjoy00/votepredict/pull/973) previously acquired contemporaneous copies of five exact 2022 campaign URLs for **four people independently verified by the original Minnesota Legislative Reference Library Senate-service directory**. Its [real acquisition run #38098726687](https://github.com/killjoy00/votepredict/actions/runs/38098726687) found two original October 6, 2022 Wayback HTML snapshots for Senator Carla Nelson, later fully authenticated in [PR #978](https://github.com/killjoy00/votepredict/pull/978) with six original short policy excerpt proofs.

The same exact-URL historical probe returned **zero 2022 captures and zero Common Crawl index hits** for three *other* actually-served senators. That does **not** establish that their campaign websites or issue positions were absent. Candidate campaign website paths routinely move. This new tranche queries each precise 2022 campaign **host** rather than just the present-day article path.

| Actual Senate member (independently LRL documented) | 2022 district | Approved candidate-host domain | Prior original exact-URL attempt (observed 2026-10-11 UTC) |
| --- | ---: | --- | --- |
| Nicole Mitchell (actual Senate service 2023–2025) | 47 | \`nicolemitchell.org\` | HTTP 200 *current*, no 2022 original snapshot |
| Rob Kupec (actual Senate service starting 2023) | 4 | \`kupec4mnsenate.com\` | HTTP 404 *current*, no 2022 original snapshot |
| Michael Kreun (actual Senate service starting 2023) | 32 | \`michaelformnsenate.com\` | HTTP 200 *current*, no 2022 original snapshot |

Every candidate name is **already documented as an actual served Minnesota Senator**. The source-acquisition runner separately verifies all three people and their specific 2022 election-year Senate district by rehashing and reparsing the previously independently downloaded original Minnesota LRL [Senate service directory](https://www.lrl.mn.gov/legdb/senate_dir). If the official original file or any person/term match is missing, **no HTTP request is sent at all**. No research output names candidates without documented Senate service, even if they ran for the same office.

## Public source GET contract

- Trigger: a single reviewed same-repository \`audit/864-\` pull request from the exact scoped branch. No cron, no push-to-main, no production environment, no write permissions, no workflow dispatch.
- Exactly **three Wayback domain-wide CDX queries**, one for each verified 2022 campaign domain, using \`matchType=domain\` with \`from=20220101\`, \`to=20221107\`, \`filter=statuscode:200\`, human-readable HTML/text formats, and \`limit=300\`. Querying host-wide (with potentially www/non-www variants) can recover original issue/home pages missing from old exact-URL queries. Maximum **300 rows per domain**, **three independently pinned original page replay requests per senator**, **nine original page replays total**, 16-second timeout and bounded HTTP response sizes. Requester only permits HTTPS to the already approved Wayback API.
- Filter result original URLs to exactly the approved campaign domain or \`www\` variant, safe path lengths and allowed content types; reject 2022 November 8 or later, pages before January 1, 2022, image/script/login/API pages, query parameter variants, malformed CDX timestamps and invalid SHA1 original digests. Keep first/latest distinct original URL digest variants and prioritize issue/platform/priority pages. **300 returned records mean index coverage may be incomplete**; no statewide archive completeness inference.
- For every query/response—including HTTP 404/429/503—preserve actual **UTC request and completion timestamps**, requested URL, HTTP status, bounded bytes SHA-256, Date and Last-Modified response metadata, and explicit failure reason.
- For a claimed 2022 archived original page, download the exact immutable \`/web/TIMESTAMPid_/ORIGINAL_URL\`, require **HTTP 200 HTML/text response and base32 SHA-1 of exact body bytes == independently downloaded original CDX index digest**. Only then set *original page captured-by* to the verified historical UTC time. The original author-first-posted time remains **unknown**, and the original candidate-authored issue statement attribution remains **unreviewed** pending manual source-text review. Store original matched HTML and raw source index in a 30-day GitHub Actions artifact; never save false-positive replay bodies as verified original.
- If the original site is only accessible now, the **known date is the actual 2026 retrieval**, not a newly inferred 2022 date. The previous run's exact observed times are pinned for successful current pages, and Rob's HTTP 404 is correctly treated as a **dated failed query**, *not* as acquired campaign text.
- Every output either refers to a real person with LRL-proven Senate service or is an aggregate of the same three. No losing-but-never-serving opponent information is needed or returned.

## Source integrity and downstream conditions

The original 2022 SOS candidate *filing export* with the 16th website field is still unrecovered; a domain associated with a 2026 candidate or a current live campaign page is **not automatically proven** as their official 2022 filing website field. Historical capture of a domain may be for a former campaign or a non-policy homepage; verifying a page's hash and capture date establishes page bytes by that date, **not** senator-authored policy issue-family stance, support/opposition or actual first publication.

The one-shot public GH job \`.github/workflows/acquire-senate-2022-served-domain-wide.yml\` takes no secrets and does not contact Neon, Vercel or election offices, mutate any source/evidence table, update historical serving/training/evaluation, backfill production, or enable recurring jobs. Issue [#864](https://github.com/killjoy00/votepredict/issues/864) stays OPEN until authentic original 2020–25 source denominators and membership/evidence rows are independently reconciled.
