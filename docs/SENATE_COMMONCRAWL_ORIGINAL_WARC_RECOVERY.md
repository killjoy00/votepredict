# #864 C — reconstructing historical campaign issue pages from Common Crawl WARC source bytes (OFFLINE)

This work follows #922 (candidate issue-page path discovery with **zero** historical archive byte proofs). This stage completes a reproducible, bounded **Common Crawl collection index → candidate-specific candidate capture → original WARC.gz byte range → original HTTP payload cross-check** workflow, without running a live collector, touching Neon/Vercel, or promoting issue statements.

## Source research status (2026-10-10)

- The [official Common Crawl collection registry](https://index.commoncrawl.org/collinfo.json) directly lists the exact first/last crawl times for 2024–25. Twenty indexes are pinned in \`data/evaluation/senate-commoncrawl-index-windows-2024-25-v1.json\`, from \`CC-MAIN-2024-10\` through \`CC-MAIN-2025-43\`, with the **original official registry response hash explicitly unverified/not stored**. A collection's existence doesn't establish that any candidate URL was crawled.
- [Common Crawl CDXJ index documentation](https://commoncrawl.org/cdxj-index) confirms index rows provide \`url\`, \`timestamp\`, \`status\`, \`mime\`, base32 SHA-1 \`digest\`, \`filename\`, \`offset\`, \`length\`. The last three fields specify one GZIP-compressed WARC record in \`https://data.commoncrawl.org/\` when requested via an HTTP Range request. Original WARC responses carry \`WARC-Type\`, \`WARC-Date\`, \`WARC-Target-URI\`, \`WARC-Payload-Digest\` and \`WARC-Block-Digest\`.
- **Current access blocker:** External HTTP requests to targeted Common Crawl CDXJ queries were not accessible from the available browsing tool, and container internet DNS failed on the official index host. This is a *retrieval limitation*, not evidence of zero captures and NOT a negative finding about any candidate. **No actual candidate index records or archive bytes were retrieved in this development run.**
- The pinned 2026 third-party page copy in #922 provides the original candidate issue URL/path **research leads only**, never proof of their 2024/2025 content. The original 2024–25 government filing-domain field remains unverified.

## Prepared collection search matrix

\`scripts/audit-senate-commoncrawl-offline.ts\` creates **275 bounded candidate×collection×page query requests** for six 2024–25 campaign domains, across all candidate-relevant official 2024/25 crawl windows, without actually querying Common Crawl. It prioritizes the most recent pre-general-election crawls and exact \`/issues\`, \`/platform\`, and \`/priorities\` pages ahead of generic domain hits.

| Candidate/election episode | Most useful historic index targets | Safe original page research targets |
| --- | --- | --- |
| Ann Johnson Stewart / 2024 SD45 | 2024 October \`CC-MAIN-2024-42\`, plus 2024 November \`CC-MAIN-2024-46\` where individual records are *strictly before Nov 5* | \`https://annjohnsonstewart.com/priorities/\` |
| Keri Heintzeman / 2025 SD6 | March \`CC-MAIN-2025-13\`, April \`CC-MAIN-2025-18\` *only record-level captures before Apr 29* | \`https://heintzemanforsenate.com/\` |
| Amanda Hemmingsen-Jaeger / 2025 SD47 | Aug \`CC-MAIN-2025-33\` and Oct \`CC-MAIN-2025-43\` | \`https://amandaformn.com/issues/\` |
| Michael Holmstrom Jr / 2025 SD29 | Aug \`CC-MAIN-2025-33\` and Oct \`CC-MAIN-2025-43\` | \`https://www.mike4mnsenate.com/platform\` |
| Louis McNutt / 2025 SD29 | Aug \`CC-MAIN-2025-33\` and Oct \`CC-MAIN-2025-43\` | \`https://louismcnuttformnsenate.com/issues\` |
| Dwight Dorau / 2025 SD47 | Aug and Oct 2025 indexes | Known publisher domain \`https://votefordwight.com/\`; exact policy path unknown |

**Critical cutoff distinction:** Collection \`CC-MAIN-2024-46\` ran November 1–15, 2024 and therefore straddles the November 5 Senate SD45 vote; \`CC-MAIN-2025-18\` ran April 17–May 1, 2025 and straddles the April 29 Senate SD6 vote. Do **not** exclude their entire index, and do **not** accept their post-vote records. Record-level UTC capture time must be strictly earlier than the event-day midnight UTC. For the primary, use its own earlier cutoff. Indexes alone never supply a valid source excerpt.

## 1. Generate the queue without any HTTP calls

\`\`\`bash
node --import tsx scripts/audit-senate-commoncrawl-offline.ts \
  --output /tmp/senate-commoncrawl-queries.json
\`\`\`

The output contains each query ID, original URL and candidate, official index ID and collection window, generated CDX API request URL, query kind (\`host_prefix\`, \`homepage_exact\`, \`issue_exact\`), primary and general vote dates, straddling-window warnings, and false historical-statement proof flags. It is created exclusively, mode \`0600\`, never overwrites an input.

Use the generated \`queries\` in priority order. Each is **a request specification only**, not a submitted search. Query output is Common Crawl's JSONL format, not the Wayback CDX JSON matrix supported by #906/#922. The planner requests \`status:200\`, selected index columns, and a maximum of 400 rows. No digest collapse means multiple versions could be retained.

## 2. Export and inspect an actual official Common Crawl CDXJ response, if externally available

From an environment that can access the public index, select a generated \`queryApiUrl\` and separately save the actual JSONL response to a local UTF-8 file. Example manual command (substitute the exact generated URL):

\`\`\`bash
curl --fail --show-error --location \
  --max-time 30 \
  'https://index.commoncrawl.org/CC-MAIN-2025-13-index?url=heintzemanforsenate.com%2F&output=json' \
  --output /tmp/cc-response.jsonl
\`\`\`

**Do not use the illustrative URL as evidence or substitute it for a real generated query.** A 404, empty body, 429, blocked query, timeout or truncation must be preserved as its respective failure/unknown status; it does NOT mean candidate absence. Common Crawl's shared public index is not a complete web census. An index HTTP 200 response is merely discovery metadata, not the WARC bytes.

For a real saved query, use its exact generated \`id\`:

\`\`\`bash
node --import tsx scripts/audit-senate-commoncrawl-offline.ts \
  --query-id cc-0001 \
  --index-jsonl /tmp/cc-response.jsonl \
  --output /tmp/senate-cc-index-review.json
\`\`\`

The offline verifier requires the record's website host to match the named candidate's domain; exact-page query responses must match their page path; CDX capture timestamp must be a possible time **within that collection's official window**; \`filename\` must be under the matching \`crawl-data/CC-MAIN-.../segments/.../warc/\` directory; \`offset\` and \`length\` must be finite integers and at most 8 MiB per compressed original WARC record. It rejects untrusted redirects to unrelated hosts, malformed digests, path traversal and date inconsistencies, and filters captures on/after the election or before the 2024 target scope.

Every surviving row includes the precise \`warcDataUrl\` and \`httpRange\`. For example, after reviewing a genuine row, the desired HTTP request is an **HTTP 206** response with \`Range: bytes=START-END\` to the explicit \`https://data.commoncrawl.org/crawl-data/...warc.gz\` URL. Verify response status, byte count and \`Content-Range\` manually or via response headers when downloading. A generic HTTP 200 full-archive response is not a valid single-record range.

## 3. Save and cross-check original WARC bytes without interpreting page text

Download **only that exact candidate/index row's compressed byte range** using the generated URL/Range values (never the whole WARC), then run:

\`\`\`bash
node --import tsx scripts/audit-senate-commoncrawl-offline.ts \
  --query-id cc-0001 \
  --index-jsonl /tmp/cc-response.jsonl \
  --record-number 1 \
  --warc-gz /tmp/one-record.warc.gz \
  --payload-output /tmp/untrusted-original-page.html \
  --output /tmp/senate-cc-warc-byte-report.json
\`\`\`

\`--record-number\` is 1-based into **the reviewer's surviving, sorted and cutoff-filtered records**, not necessarily the source's raw JSONL row number. A page of HTTP 404 results or truncated import is not a certified census. Both new payload and report are exclusive \`0600\` outputs.

The WARC validator:
- checks supplied compressed byte length equals the CDX \`length\` and gzip CRC/size, and caps decompression to 24 MiB;
- parses precisely one WARC \`response\` record, with exact \`WARC-Target-URI\` and \`WARC-Date\` matching the candidate's indexed original URL/timestamp;
- checks WARC \`Content-Length\` and original embedded HTTP **200** status plus HTML/text media type;
- verifies both SHA-1 base32 **WARC block digest** and **payload digest**, and requires the payload digest match the supplied CDXJ \`digest\`;
- computes SHA-256 for the compressed range, uncompressed WARC, embedded HTTP response block, and exact original HTTP page body;
- rejects revisit or redirect records, truncated members, checksum discrepancies, cross-candidate links, corrupted encoding/chunked bodies, election-day or post-election timestamps;
- leaves original **index authenticity** and **remote WARC response provenance** explicitly **unverified**, because a local pair of matching files could have been fabricated. Supplying bytes cannot prove the archive service actually returned them. Also leaves attributed candidate excerpts, original posting date and forecast eligibility **unverified/false**.

This is a concrete stepping stone from mere URL/index leads to independently checkable original response bodies. **It does not automatically convert raw site text into a campaign issue stance.** Verify independently how the actual bytes were retrieved, candidate-site provenance and election timing, then manually inspect exact issue statement snippets and version changes. Build a follow-on typed, separately reviewed \`CampaignArchiveCapture\`/\`CampaignIssueStatement\` source for #902 only when first historical public-by and candidate attribution are defensible. No automatic platform statement import exists in this PR.

## What's still required

1. Actually retrieve official collection CDXJ query responses for the targeted six campaigns and store the original response provenance, including HTTP status, URL, collection ID and response SHA-256. **No archive hit is claimed in this tranche** because index requests remain inaccessible in the current runtime.
2. Retrieve original candidate WARC HTTP 206 ranges; capture response headers, hashes, WARC target/timestamp and original embedded HTTP page bytes. Preserve failures/gaps explicitly. A \`revisit\` reference or content-encoded HTTP body must be resolved separately; never fake the missing response.
3. Compare actual pre-2025 and 2025 issue excerpts between capture versions; distinguish layout changes from genuine policy changes. Handle candidate vs supporter/third-party authorship.
4. Obtain historical SOS official candidate filing website-field source bytes for 2020/2022, and 2020–25 senator roster/source-to-evidence records only via separately authorized SELECT-only export. Do not infer statewide completeness from six domains or the 2025 special elections.
5. Keep [#864](https://github.com/killjoy00/votepredict/issues/864) OPEN. No Neon/Vercel production reads/writes, scheduled archive collector, model serving, retraining, app deploy, or frozen artifact changes in this tranche.

**Documented archive limitations:** [Common Crawl WARC/CDXJ documentation](https://commoncrawl.org/cdxj-index), [official collection registry](https://index.commoncrawl.org/collinfo.json), [WARC revisit record differences](https://commoncrawl.org/errata/warc-content-type-header-in-revisit-records). Archived revisions still need exact historical capture timing, not webpage title/year labels or later 2026 GitHub snapshot content.
