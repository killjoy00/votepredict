# #864 C — verified archived candidate policy excerpts, exact HTML and first attested capture times (2024–25)

## Material progress: real archived campaign positions recovered

PR #932 did **actual public HTTP acquisition**. Its [GitHub Actions run #38086478508](https://github.com/killjoy00/votepredict/actions/runs/38086478508) retained archive response bytes, including:

- **12 exact \`id_\` Wayback replay HTTP 200 responses** tied to 12 earlier independently acquired 2024/25 CDX index rows. **10** have **exact original page SHA-1 base32 equal to the indexed digest**. **Two** (Michael Holmstrom July 31 and Dwight Dorau July 31) do not and may not be used for statements.
- **One original Common Crawl WARC** byte range for Ann Johnson Stewart's **2024-10-10T02:14:35Z** \`/priorities/\` page. The gzip, WARC target/UTC timestamp, HTTP 200, block and payload digests passed in the updated checker; the original HTML SHA-256 matches **the independently retrieved Wayback page from precisely the same time**.
- A separately acquired original 2025-08-03 Dorau campaign WARC from PR #932's earlier run. That homepage verifies Senate campaign identity and general cross-party governance language but does not support a defensible specific family-level policy stance.
- The March 20, 2025 Keri Wayback \`id_\` replay is **only a 114-byte HTML redirect script to \`/lander\`**. Its digest matches the index, but it has **zero candidate positions**. Therefore the **first substantive Keri issue text verified in this sample was captured Apr 24, 2025**; do not backdate it to March 20 merely from the existence of a matching capture.
- All sources and SHA-256s are in archive artifact \`senate-campaign-public-archive-source-acquisition-v1\`, artifact ID \`11682363094\`, ZIP SHA-256 \`c20cd41da68fac461f05f17b6782abb34202d4add22cd9b5ea826610c3a8f8fb\`, from a GitHub Action run on 2026-10-10. The exact compressed WARC/original \`id_\` HTML files are **not** added to Git; the GitHub artifact is retained 30 days. Archived URLs and source hashes are pinned in permanent repository JSON, which can support independent future retrieval.

## Exact short excerpts and guarded attribution

A new human-reviewed, machine-recheckable ledger stores **13 short, directly original-campaign-page excerpts across four candidates**, with the precise candidate-election, source \`id_\` capture, original HTML SHA-256, historical CDX SHA-1 digest (from #932 pinned index), and conservative date the words were **attested by**. Excerpts are concise and deliberately do not reproduce full platforms. Source: \`data/evaluation/senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1.json\`.

| Campaign | Specific campaign policy page | First attested short-excerpt version *in this sample* | Issue families in ledger | Eligibility caveat |
| --- | --- | --- | --- | --- |
| Ann Johnson Stewart / **2024 SD45** | \`https://annjohnsonstewart.com/priorities/\` | **2024-09-04 05:28:50 UTC** | reproductive healthcare access; union organizing; tax reductions; climate action | After **Aug 13** primary; before **Nov 5** general |
| Keri Heintzeman / **2025 SD6** | \`https://heintzemanforsenate.com/\` | **2025-04-24 16:32:55 UTC** | anti-abortion advocacy; income/property tax reductions; opposition to restrictions on gun ownership | After **Apr 15** primary; before **Apr 29** general |
| Louis McNutt / **2025 SD29** | \`https://louismcnuttformnsenate.com/issues\` | **2025-08-26 22:22:28 UTC** | medical autonomy; Social Security income tax repeal; special-education cross-subsidy funding | **On the Aug 26 primary date**, never eligible at that primary's same-day cutoff; before **Nov 4** general |
| Michael Holmstrom Jr / **2025 SD29** | \`https://www.mike4mnsenate.com/platform\` | **2025-08-26 22:26:50 UTC** | anti-abortion advocacy; school choice legislation; constitutional carry | **On the Aug 26 primary date**, not eligible at that primary's same-day cutoff; before Nov 4 general. Winning senator outcome **not inferred** |

Statements are **authored on the original named candidate's own campaign page** (including campaign committee paid-for-by text), but their historical Secretary of State candidate filing-field website assignment remains unverified. Separately identify the specific person for any future membership join. A defeated candidate's positions **must never be attributed to the senator who won the seat**. Similarly, a historic 2024 campaign page must not be reassigned to a different 2020 candidacy. No 2026 later-crawl excerpt is substituted for original bytes.

**Important time semantics:** An archive capture proves the specific snippet appeared **no later than the archived capture**. It does **not** establish the page's original publishing date, any earlier public availability, or that the statement remained unchanged afterward. Duplicate digest captures can confirm stable copied bytes, but a different digest does not itself prove a policy reversal. Within our sample, Ann's September, October, November text substantively retains these short positions and Louis's August and October issue lists retain most positions (a separate misspelling changed); exact version comparison should remain quote-by-quote, not rely solely on site hashes.

## Fully reproducible, offline recheck against preserved source artifact

First generate a dry-run report that **never claims bytes were newly rechecked**:

\`\`\`bash
node --import tsx scripts/audit-authenticated-senate-campaign-excerpts-offline.ts \
  --output /tmp/senate-historical-excerpt-review-plan.json
\`\`\`

Download the GitHub Action source artifact \`11682363094\` for run \`38086478508\`, save the ZIP, independently verify its SHA-256 \`c20cd41da68fac461f05f17b6782abb34202d4add22cd9b5ea826610c3a8f8fb\` and extract into a local source directory. Then:

\`\`\`bash
node --import tsx scripts/audit-authenticated-senate-campaign-excerpts-offline.ts \
  --archive-dir /path/to/extracted-source-files \
  --output /tmp/senate-historical-excerpt-verified-v1.json
\`\`\`

The verifier: checks the 4 candidate identities, Senate districts and actual election years against pinned website leads and the exact previously acquired original Wayback CDX manifest; validates that the four \`snapshot-01/05/06/09\` archive dates are strictly before the general and not before the primary; checks that all candidate sources retain no verified official SOS website-field flag; compares each actual original HTML **SHA-256** and **SHA-1 base32** to independent acquired snapshot records; HTML-entity-decodes and strips scripts/styles, then requires each of the **13** short phrases to occur literally in the visible campaign page; rejects missing/modified source body, unrecognized or duplicate candidates, out-of-scope years, quote substitution, mismatched digests, and claims of earlier original page publication. All output is exclusive \`0600\`, no network, no production data access and zero automatic model/evidence writes.

Without the raw HTML supplied, it outputs 4 candidate / 13 **pending local byte rechecks**. With the preserved exact four HTML bytes, expected result is **4 source bodies / 13 excerpt spans locally reverified**, not automatically *13 enrolled production evidence rows*. There is no inference from a missing file that a website never contained a position.

## Why the historical completeness ticket stays open

This is an **audited four-candidate sample** focused on the 2024 and 2025 Senate election episodes, not a statewide 2021–2025 senator-by-senator corpus. Several candidates in our source collection were unsuccessful, and the most relevant source election/primary cutoffs differ per candidate. The archive discovery window is bounded, and Wayback/Common Crawl failures do not prove absence of pages. The 2020 and 2022 statewide original SOS candidate filing exports with campaign-site fields, full senator roster/membership identity, and authorized SELECT-only source/evidence row reconciliation remain outstanding.

**Do not change serving, historical feature freezes, scheduled backfills, forecasts or evidence tables on the strength of this ledger.** A separate human-reviewed, owner-authorized decision and DB reconciliation are necessary before converting these independently archived candidate page excerpts into training or forecasting evidence. Issue [#864](https://github.com/killjoy00/votepredict/issues/864) remains OPEN.
