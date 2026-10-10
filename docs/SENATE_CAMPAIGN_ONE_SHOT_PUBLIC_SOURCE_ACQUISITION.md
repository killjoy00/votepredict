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
