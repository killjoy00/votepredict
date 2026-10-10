# #864 C — actual Senate primary-ballot candidate observations (2022 + 2024 SD45)

This is the next, source-backed tranche after the 2020/2022 winner and 2024/2025 special election inventory in \`SENATE_SOS_HISTORICAL_WEBSITE_INVENTORY.md\`.

## New candidate identities actually recovered

- **2022 Senate state primary (August 9, 2022):** 75 candidate/election observations in **24 Senate districts** with contested primary ballot races.
- **2024 state primary (August 13, 2024):** four candidate/election observations in **Senate District 45 only**, associated with the special Senate election; the 2024 state primary was NOT a statewide 67-district Senate election.
- **Combined:** 79 primary ballot identity observations in 25 district/election combinations. **25** are same-name/same-district matches to a winner already independently identified by the prior election-result inventory; the remaining **54** are other ballot candidate observations (51 in 2022, 3 in 2024). This does **not** mean all 54 lost a primary: many became general-election nominees and lost in November.
- These 79 observations may include the *same person* across elections and overlap the 139 previously inventoried post-election winner observations. They cannot be added to produce unique-candidate, website, membership, or statement completeness denominators.

The new source data is checked in as \`data/evaluation/senate-primary-ballot-candidate-observations-2022-24-v1.json\`. Candidate IDs, original file labels, year, district, party codes and original URL provenance are preserved; NO address, phone, email, campaign-site URL, campaign statement or private voter information is included.

### Original source vs. independently available mirror

| Election | Original SOS primary result download index | Explicit SOS source URL | Research copy (immutable GitHub SHA-1) |
| --- | --- | --- | --- |
| Aug 9, 2022 | https://electionresults.sos.mn.gov/Select/MediaFiles/Index?ersElectionId=148 | https://electionresultsfiles.sos.mn.gov/20220809/cand.txt | PatrickFanella/left-field, \`bb16cbfdf6b91e2b20e2c6882b0bfc57a40a0fe3\` |
| Aug 13, 2024 | https://electionresults.sos.mn.gov/Select/MediaFiles/Index?ersElectionId=169 | https://electionresultsfiles.sos.mn.gov/20240813/cand.txt | PatrickFanella/left-field, \`e7a86254c0d3ea1eead252f1f350f13e0919c190\` |

Pinned upstream commit for both research copies: \`c0f0b78eda7564532d4c94f8338b8b06ca2a603f\`.

2022 copy: https://github.com/PatrickFanella/left-field/blob/c0f0b78eda7564532d4c94f8338b8b06ca2a603f/data/source/elections/primary-results/minnesota/2022/candidates.txt

2024 copy: https://github.com/PatrickFanella/left-field/blob/c0f0b78eda7564532d4c94f8338b8b06ca2a603f/data/source/elections/primary-results/minnesota/2024/candidates.txt

The official SOS election-result index independently exposes a **candidate support table called \`cand.txt\`**, which is described in SOS election layout documents as a **seven-column** file:
\`Candidate ID ; Candidate Name ; Office ID ; Office Title ; County ID ; Party ID ; Party Abbreviation\`.

We verified the SOS links/index and compared schema and Senate district counts against the pinned copies. We also inspected the actual official 2024 text; **we have not performed cryptographic raw-byte-to-original verification of either original SOS file**. The pinned GitHub blob SHAs authenticate the immutable *research copies*, not the original government file bytes. Thus no assertion of a complete independently authenticated 2022 or 2024 original SOS filing export is made.

## Important: there are THREE different SOS candidate file schemas

This distinction is essential to avoid corrupt campaign website proofs:

1. **General election candidate filing export** (SOS's \`candidate-files-layout.txt\`): semicolon-separated, \`Campaign Website\` field 16 (zero-based index **15**). Contains personal/contact fields. This was supported by PR #911, but **no original historic 2020/2022 filing export has been acquired**.
2. **Election-result \`cand.txt\` identity lookup**, 7 fields and **NO website field**. This is the 79-observation source of this PR. It is explicitly prohibited from creating historical website evidence.
3. **Election-result \`CandTbl.txt\` "Address Information"** documented in the SOS election-result layout: candidate ID, name, office, county, party ID, party abbreviation, then addresses and campaign details, with \`Campaign Website\` at index **16**, not 15. **This 21-column file has NOT been acquired**, is not linked in the downloaded SOS index, and must not be passed as a seven-column identity roster or as a general-election filing file. A wrong layout can misread a phone as a website.

See SOS source format: https://www.sos.mn.gov/media/2513/candidate-files-layout.txt and SOS 2020 results source layout: https://electionresults.sos.mn.gov/Results/MediaFileLayout/Index?erselectionId=136.

## Run the actual offline source ledger and produce a gap report

\`\`\`bash
node --import tsx scripts/audit-senate-primary-ballot-observations-offline.ts \
  --output /tmp/senate-primary-candidate-evidence-gaps.json
\`\`\`

Output includes each of the 54 other candidate identity observations with SOS result URL and no website proof, all 25 candidate identities matching previously independently sourced general winners, and \`zeroRecordedCampaignPositionsMemberRows: null\` (correct **unknown** value without a database export).

Optional, with a **separately authorized SELECT-only historical membership JSONL export** as described in \`scripts/sql/senate-2021-25-campaign-issue-priority-select-only.sql\`:

\`\`\`bash
node --import tsx scripts/audit-senate-primary-ballot-observations-offline.ts \
  --memberships /path/to/explicitly-authorized-2021-2025-senate-members.jsonl \
  --output /tmp/senate-primary-candidates-with-P0-priorities.json
\`\`\`

This ranks membership rows with zero **stored campaign-site \`issue_position\` items** before rows with existing campaign items, while preserving the ambiguity of candidate-name aliases and seat/membership terms. It may attach an exact normalized 2022 primary ballot candidate ID to a 2023–24 or 2025 session member (or a 2024 SD45 primary ID to an SD45 2025 membership) but it cannot prove pre-vote statements, candidate website origin, term-bound identity, or the official roster denominator.

Optional raw source comparison after obtaining a copy locally:

\`\`\`bash
node --import tsx scripts/audit-senate-primary-ballot-observations-offline.ts \
  --2022-cand-file /path/to/20220809-cand.txt \
  --2024-cand-file /path/to/20240813-cand.txt \
  --output /tmp/senate-primary-local-file-comparison.json
\`\`\`

The offline parser verifies **all seven columns**, rejects 21-column address-bearing files, checks local parsed identity rows exactly against the pinned ledger, and returns a local SHA-256 of supplied text. It deliberately does **not** claim to authenticate its external provenance or assign historical earliest public-by timestamps. It will fail rather than silently substitute a mismatching local file. The CLI has input size caps and exclusive \`0600\`-permission output; no network, production database, scheduler, model serving, or unapproved collector execution.

## What's genuinely still missing

- Independent historical original candidate **filing** source bytes for 2020, 2022 and subsequent 2024/2025 special races, including primary losers, withdrawn candidates, missing website fields, changes over time and original-file SHA-256. Today’s SOS filings finder is for 2026 and cannot be used to backdate.
- Official 2020 primary, 2020/2022 general **nonwinning** candidate records, and all 2025 special-election contests; this 2022/2024 primary tranche is only a subset of the universe.
- Actual historical campaign domains/pages and multiple issue-page archive versions with independently verified earliest public-by timestamps; no 79 candidate observations are forecast-eligible.
- Approved read-only membership/source-document export to identify named 2021–2025 senator **campaign-only** coverage gaps, with source-to-evidence hash/version reconciliation using PRs #902 and #906.

**Issue #864 remains open; production untouched.**
