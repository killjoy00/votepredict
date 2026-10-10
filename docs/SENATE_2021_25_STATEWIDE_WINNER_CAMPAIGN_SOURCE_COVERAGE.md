# #864 C — Statewide election-winner candidate campaign issue SOURCE RECOVERY ledger (2021–2025 scope)

## Why this audit exists

The two original SOS general-election source files per election were actually downloaded in #948 and verified against the independent official candidate lookup. Combined original sources yield **67 winning and 79 losing named candidates in the 2020 general**, **67 winning and 64 losing candidates in 2022**, plus 67 write-in aggregates each. There are **five** separately documented 2024/25 special-election winners. This produces **139 winning candidate-election observations**: 67 + 67 + 1 + 4. These are **not 139 unique people, not 139 actual senator memberships, not the complete 2021–25 senator-year universe**. A winner's service dates and midterm vacancy must be checked against an independently authoritative membership roster.

This source-focused report answers a precise question: *How much of the official winning candidate identity seed sample has a publisher-carried campaign website URL, an original authenticated historical campaign-issue HTML page, or a separate candidate-submitted publisher questionnaire?* Do not count any of those as complete state-wide policy-position coverage.

## Observed candidate-level source recovery (not full candidate-filing universe)

| Winner election cohort | SOS winner observations | Publisher-carried candidate website URLs | Independent historical campaign issue page (Wayback originals + digest) | Winner respondents' 2022 questionnaire lead excerpts (no historical page proof) |
|---|---:|---:|---:|---:|
| 2020 general (source identity target 2021–22) | 67 | 0 | 0 | 0 |
| 2022 general (source identity target 2023–24, with 2025 tenure to audit separately) | 67 | 0 | 0 | 4, across Rob Kupec and Michael Kreun |
| 2024 SD45 special | 1 | 1 | 1, Ann Johnson Stewart (4 issue excerpts) | 0 |
| 2025 specials SD6, SD29, SD47, SD60 | 4 | 3 | 2, Keri Heintzeman (3) and Michael Holmstrom Jr. (3) | 0 |
| **Total observation count** | **139** | **4** | **3 (10 excerpts)** | **4 unverified 2022 public-by** |

**136 of 139** winner election observations currently lack an independently rechecked original historical candidate-owned campaign issue HTML page in this **reviewed ledger**. This is a source-recovery gap count, not an assertion that those candidates lacked a website, had no policy positions, or served/failed to serve every day of any term.

Publisher website lead URLs for Amanda Hemmingsen-Jaeger (2025 SD47) are NOT equivalent to her 2025 historical original policy page. Doron Clark (2025 SD60) has no site lead yet *in this corpus*, NOT proven website absence. Distinct losing candidate Louis McNutt (2025 SD29) has 3 actual authenticated archived original campaign issue excerpts, which remain **excluded** from Holmstrom's winner coverage. Likewise defeated 2022 opponents Dan Bohmer and Kate Luthner have 4 short candidate-submitted survey issue excerpt leads, none assigned to elected senators.

## Original official source re-verification

\`scripts/audit-senate-statewide-campaign-source-coverage-offline.ts\` supports two modes:
- **No source input**: produces a clearly labeled **ledger-only** 139-row candidate identity source-missingness report; does **not** claim SOS original bytes checked during that run.
- **Four input files**: independently runs the 2020/22 SOS semicolon row parser on original \`stsenate.txt\` and 7-column \`cand.txt\` downloaded in the prior PR, rehashes all four original byte files to the exact pinned SHA-256 values, validates 67 winning districts and 146/131 candidate identities, and crossjoins **each** of the 134 candidate winner observations by year+district+normalized name. Rejects duplicate winners, wrong original format, winner-name disagreement, unauthenticated source hashes, source rows falsely carrying website fields, and truncated inputs.

A dedicated, same-repository pull-request workflow \`.github/workflows/audit-senate-statewide-campaign-sources.yml\` downloads *only already-acquired public sources* from [source run #38089571113](https://github.com/killjoy00/votepredict/actions/runs/38089571113), computes the 139-row report in memory, and retains a 30-day sanitized audit JSON artifact (not the original public text files). **No Neon/Vercel, source/evidence writes, current candidate finder, election scheduling, model training or serving changes**.

Run locally after extracting the source artifact:

\`\`\`bash
node --import tsx scripts/audit-senate-statewide-campaign-source-coverage-offline.ts \
 --2020-st path/to/2020-sos-general-stsenate.response \
 --2020-cand path/to/2020-sos-general-cand.response \
 --2022-st path/to/2022-sos-general-stsenate.response \
 --2022-cand path/to/2022-sos-general-cand.response \
 --output /tmp/senate-2021-25-candidate-source-gaps.json
\`\`\`

## What this DOES NOT certify

1. The SOS **filing exports** as published **during 2020/22 filing periods** with campaign website in 16th semicolon field: no original historical 2020/22 file acquired or independent public-by timestamp verified. The downloaded 7-column election result \`cand.txt\` has **no website field**.
2. Every candidate on primary ballots, filed then withdrew, or in earlier special races, and all senator **membership start/end dates**. A winning election result is NOT a complete legislator tenure chronology. The verified 2025 three-district Neon read-only export cannot establish statewide member-year denominator and does not prove deployed-production binding.
3. Dated original 2020/22 candidate *issue pages* from Wayback/Common Crawl, or independent historical capture of the two 2022 Ballotpedia respondent quote articles. The publisher's 2022 article date viewed in 2026 does not establish exact original page availability at that pre-election time.
4. The absence of a campaign website or an issue position. A missing URL/quote means **not recovered in this reviewed source set**, not absent in history.
5. Any source-admission qualification for historical forecasts. Official winners were not known before their election; archive capture date is an attested *upper-bound on original availability*, not the true authoring date. No evidence or model is modified by this audit.

**Next priority:** original 2020/22 SOS filing export snapshot/website URLs, then archived 2020/22 candidate issue pages, then independent membership-roster and production evidence row reconciliation. #864 remains OPEN; no unsolicited office outreach.
