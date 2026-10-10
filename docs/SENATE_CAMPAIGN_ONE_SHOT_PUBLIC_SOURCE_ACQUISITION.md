# Issue #864 — one-shot public historical Senate campaign source acquisition

Unlike #922 and #927 (offline research queue and synthetic WARC byte validation), this tranche **actually executes bounded network GET requests** against public archive indexes and public publisher web pages, records HTTP response headers/status/body hashes and preserves exact acquired bytes as GitHub Actions artifacts. It is **public-only; never reads production credentials, Neon, Vercel or historical prediction data** and never publishes an issue stance.

## Exact network scope and trusted trigger

- New workflow: \`.github/workflows/acquire-senate-campaign-archive-public-sources.yml\`.
- Runs on one review PR from this repository's \`audit/864-...\` branch, or when repository owner **killjoy00** leaves an issue #864 comment starting \`[campaign-archive-public-acquire-v1]\`. No cron, schedule, push-to-main trigger, production environment, secrets, write permissions or public contact.
- Fixed **14 Common Crawl queries** drawn from #927's 20 official index windows: 2024 SD45 (Aug, Oct, vote-straddling Nov); 2025 SD6 (Feb, Mar, vote-straddling Apr); and 2025 SD29/47 (Aug/Oct) for four exact policy URL leads plus Keri/Dwight homepages.
- **Six targeted Wayback CDX queries** (only publisher-linked original candidate issue/homepage paths) capped to before each election day, using 2024 onward window. These avoid a full replay/collector. No same-day assumption.
- **Six direct contemporary publisher/source page GETs**, to preserve the actual response bytes now served by: [Lakeland PBS 2025-04-10 SD6 candidate forum](https://lptv.org/public-forum-held-with-mn-senate-district-6-republican-primary-candidates/), [2024 SD45 MN Family Voter campaign-platform attribution](https://www.mnfamilyvoter.com/candidate/mn-state-senate/johnson-stewart-ann/), [2025 SD6 candidate-submitted Lakes Area Vote questionnaire](https://lakesarea.vote/keri-heintzeman/), [original Dwight Dorau 2025-07-30 campaign candidacy announcement](https://votefordwight.com/candidacy-announcement), [2024-10-27 Minneapolis Labor Review SD45 direct candidate interview](https://minneapolisunions.org/news/mlr2024-10-19_SD-45-Ann-Johnson-Stewart), and [2025-10-28 MPR SD29 and SD47 candidate interviews](https://www.mprnews.org/story/2025/10/28/senate-majority-at-stake-in-minnesota-special-elections-in-washington-wright-counties). The currently returned publisher HTML and declared article date **are not independently confirmed pre-vote copies**, even when the visible article itself contains a dated candidate quote.

All requests have explicit HTTPS allowlisted hosts; no dynamic arbitrary URL, no redirects, no credentials; 14-second request timeout, 2 MiB per index response, 1 MiB per publisher response, no more than 8 separately selected compressed original WARC records of at most 8 MiB each. Four concurrent index requests at a time; no re-executed failed response unless a future owner command explicitly re-invokes.

## Source acquisition artifact

The job uploads \`senate-campaign-public-archive-source-acquisition-v1\`, retained **30 days**. It includes:
- \`acquisition-manifest.json\`, generated with \`flag=wx\`, \`0600\`, recording each exact request, fetch time (2026-10-10 or run date), HTTP status, response URL, selected response headers (Date/ETag/Last-Modified/Content-Type/Content-Range), **SHA-256 of returned decoded HTTP body** and size, error/timeout, attempted and completed counts, and provenance classes.
- \`cc-index-cc-NNNN.jsonl\` only if an actual Common Crawl index response returned HTTP 200 within the cap and was saved. The raw index remains *unverified metadata*, and an empty 200 index is not a certified absence (small sites may never be crawled).
- If a **real candidate pre-election index hit** passes #927's CDX source host, path, timestamp and safe WARC filename/range validation, the workflow requests at most two candidates' WARC versions per site (max eight total), by **HTTP Range** to \`https://data.commoncrawl.org/...\`. It insists on an **HTTP 206 plus exact \`Content-Range\`** before accepting the retrieved compressed byte range; then applies #927's original WARC HTTP-200/GZIP CRC/target/time/dual SHA-1 digest checks and produces original page SHA-256. The exact downloaded WARC record and matched original HTTP page bytes are preserved only on byte/range success, and copied into an artifact for manual follow-up.
- \`wayback-index-NN.json\` only on a successful actual bounded CDX response, with pre-vote capture candidates if present. **This tranche does not claim a Wayback index row alone verifies original archived HTML**. Replaying a Wayback snapshot is a separately guarded next action.
- \`media-sd6-20250410.html\`, \`2024-mnfamilyvoter-sd45.html\`, \`2025-lakesarea-vote-sd6.html\`, \`2025-dorau-original-announcement.html\`, \`2024-unions-sd45-interview.html\`, \`2025-mpr-sd29-sd47-interviews.html\` (only if HTTP 200 and within cap). These are **presently fetched publisher copies**, NOT original 2024/2025 archive response bytes.
- Workflow logs summarize 200/404/403/429/timeout, content hash and indexed pre-election row counts, without printing full page text or authoring stance evidence from a page.

Every record explicitly maintains the distinctions **currently retrieved HTML ≠ independently time-proven historical page**, **CDX index ≠ WARC response**, **WARC body hash ≠ pre-vote candidate position excerpt**, and **opponent ≠ senator**. No source obtained means "not recovered from this bounded sample", NOT "did not exist".


## Actual evidence recovered by PR #932's early acquisition attempts (2026-10-10)

This section records **completed original retrievals**, not projected query results, with run IDs and content hashes so another researcher can reproduce the observations:

### 2025 SD47 original campaign homepage — recovered from Common Crawl

- The public collection \`CC-MAIN-2025-33\` returned **one real CDX index hit** for \`https://votefordwight.com/\`, original capture timestamp **2025-08-03T20:43:02.000Z**, before both the **Aug 26, 2025 primary** and **Nov 4, 2025 general**.
- The next GitHub runner actually downloaded original WARC bytes from \`https://data.commoncrawl.org/crawl-data/CC-MAIN-2025-33/segments/1754151279735.55/warc/CC-MAIN-20250803200137-20250803230137-00256.warc.gz\` using \`Range: bytes=536529311-536551294\`; response was **HTTP 206** with exact \`Content-Range: bytes 536529311-536551294/1008336949\`, **21,984 gzipped bytes**.
- The precise compressed range SHA-256 was \`5bc873936bbc9cee0e72c0ca317ad39dfe7b080a590bdaf790adaf025a8ef507\`. Independent local decoding and checksum verification found WARC block SHA-1 base32 \`6BXPZF7243LKPJ7JYU4HXDA2GEZPQ5PZ\` and original HTML payload SHA-1 base32 \`SPLKPD3I5ZYDKIAAJVDR6N5RA2OHDFWT\`, both exactly matching stored WARC digests and the separate original Common Crawl CDX index. Original HTTP status **200**, HTML body **98,491 bytes** with original body SHA-256 \`b950e489df039d69737f335e45e035fc10691817943bb014947fce6530a2b261\`. This is real historical original HTML, **not a synthetic fixture**.
- The original page itself identifies **"VOTE DWIGHT DORAU FOR MN SENATE DISTRICT 47!"** and uses campaign-authored messages about governing for constituents, not political parties. This validates a **specific candidate and historical campaign presence**, not an attributable policy-family support/opposition stance; **zero new issue stances/forecasts are promoted** from this source.
- Actual public source run [#38085831693](https://github.com/killjoy00/votepredict/actions/runs/38085831693), artifact \`11682766440\` (compressed + original source responses, retained 30 days). Source ZIP SHA-256 \`04f7a8f3de38e1cb3698034102fd34470e802ce03c96a841bb32381e41d8e052\`, manifest SHA-256 \`cbbf504e4c4198bf0951fdee93c5781a3c7543a6796ea79d9bc1fdc9f0ff471f\`. Exact provenance ledger: \`data/evaluation/senate-2025-sd47-original-commoncrawl-source-proof-v1.json\`.
- The first automated validator rejected the source because original Common Crawl WARC contains **two legitimate, distinct \`WARC-Protocol\` transport metadata fields**, HTTP/1.1 and TLS/1.3. The validator has been updated to accept duplicate WARC-Protocol **only** while continuing to fail on duplicate original target, date, WARC block/payload digests, malformed timestamps or HTML bytes. The fix requires green CI and an actual WARC rerun to claim automation has reproduced the manual original-source checks.

### 55 actual Wayback index records, split by candidate campaign year

A completed independent acquisition run [#38085775020](https://github.com/killjoy00/votepredict/actions/runs/38085775020), artifact ID \`11682351954\` (source ZIP SHA-256 \`a0141b9a6f9e558675a7528db57a4498b0674662afe4cd28a3c500196826de8f\`; acquisition-manifest SHA-256 \`440ed8e6445e513359d1a7ed80aca5cc1957a3a962dc29598efdcc377330c1d7\`) returned six **real Wayback HTTP 200 CDX response matrices** and **55** original-path archive-index rows captured before relevant vote cutoffs.

**Do not equate 55 records with 55 Senate campaign captures.** Exact original-index breakdown:
- **Ann Johnson Stewart 2024 SD45 \`/priorities/\`: 5 index rows.**
- **Keri Heintzeman 2025 SD6 homepage: 7 rows** (including duplicate protocol spellings/digests).
- **Louis McNutt 2025 SD29 \`/issues\`: 2 rows.**
- **Michael Holmstrom Jr 2025 SD29 \`/platform\`: 4 rows.**
- **Amanda Hemmingsen-Jaeger 2025 SD47 \`/issues/\`: 0 rows** in this **specific exact URL** index query, **not proof site had no history**.
- **Dwight Dorau \`/\`: 37 rows**, **20 in 2024**, when the site was used for a *prior House candidate campaign*, and 17 rows in 2025. Even the 2025 indexed captures before Dorau's July 30, 2025 candidacy announcement do **not** automatically establish their content is specifically about the 2025 SD47 Senate campaign. Explicitly separate campaign cycles.

This is **35 pre-vote, same-election-calendar-year indexed entries across the six domains**, not 35 verified issue statements. Index count includes duplicate content digests. \`data/evaluation/senate-wayback-real-cdx-selected-replay-2024-25-v1.json\` pins 12 selected real timestamp+originalUrl+digest combinations (Ann 3, Keri 2, Louis 2, Michael 2, Dwight post-announcement 3) for actual original \`/web/TIMESTAMPid_/URL\` snapshot GETs. The source acquisition script **now attempts those twelve**; a live archived snapshot is recorded as **historical byte proof only when its SHA-1 base32 payload digest actually matches the independent historical CDX digest**. Memento HTTP response headers and 2026 retrieval body SHA-256 are saved separately. Archive HTML response status 200 without matching digest remains **unverified original text**.

### Publisher quotation leads and responsible use

The current actual HTTP HTML from the Lakeland PBS SD6 candidate forum, Lakes Area Vote Keri questionnaire, October 2024 Minneapolis Labor Review/Ann interview and October 2025 MPR Senate-special-election candidate interviews has been acquired and hashed in the one-shot run. Those pages' **current 2026 response copies** give real source-author/candidate/issue leads but **do not independently prove their displayed publication dates**, unlike a matching pre-vote archive WARC/page copy. The 2025 MPR interview includes direct statements from multiple **different candidates**, requiring per-speaker attribution before any candidate issue-position claim. Original Dwight July 2025 campaign press-release fetch and Minnesota Family Voter direct GET failed during one run; they must not be silently treated as source bytes obtained.

These retrievals materially change source recovery status: an actual original pre-election campaign homepage **is proved**, and original archive search has real index data. They **do not certify historic statewide campaign issue statement completeness, official SOS campaign-URL assignments, or any issue stance for forecast use**.

## Manual review requirements when a real record arrives

1. Open GitHub Actions artifact for the run. Match \`queryId\`, candidate, election, original page URL, index \`timestamp\`, \`filename\`, exact byte range, HTTP 206 headers and gzip CRC.
2. Re-check archive response against actual remote source, record original artifact repository URL and SHA-256. Verify campaign domain attribution to the candidate/campaign cycle; original 2024–25 Secretary of State filing website-field bytes are still a separate gap.
3. Independently inspect the exact archived page text and candidate/endorser identity and manual issue family/stance. Compare oldest and next preserved versions; identify earliest attested public-by for **specific words**, not site first appearance, article date, election year, or current live text.
4. Only add individually verified issue statement evidence via the existing #902 campaign platform audit/trace and *separately authorized* SELECT-only membership/evidence reconciliation; no automatic forecast ingestion.
5. Keep [historical completeness issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN until statewide 2021–2025 site denominators, 2020/2022 originals, archive capture and DB reconciliation are actually established.

## Run commands / provenance

This is a one-shot action, not an unattended agent. From the repository root (with an Internet-capable approved runner):

\`\`\`bash
node --import tsx scripts/acquire-senate-campaign-public-archive-sources.ts \
  --output-dir artifacts/senate-campaign-public-archive-acquisition-v1
\`\`\`

A run **refuses to overwrite** an existing output directory, and writes both acquired public-response bytes and report exclusively, \`0600\`. The GitHub artifact itself may be downloaded by those authorized to the repository. Do not treat the artifact retention timer or GitHub Action run time as evidence that source text was online before an election.

**Data lineage:** #922 later-2026 campaign site-page URLs → #927 official Common Crawl windows and offline WARC verification → this one-shot controlled, direct public-source acquisition. No production DB access, live collector, scheduler, historical training/model, or frozen evaluation changes.
