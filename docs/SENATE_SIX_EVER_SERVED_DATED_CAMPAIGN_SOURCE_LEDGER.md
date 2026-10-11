# #864 — A single dated Senate-service-only campaign issue research ledger

This consolidated report is **not a statewide coverage completeness certificate**. It combines already verified research sources into a directly usable six-senator dated research ledger and prevents historical source backdating or non-senator quote attribution.

## Six actual Minnesota senators, twenty dated short source excerpts

| Actual Senate member | Issue research excerpts | Earliest demonstrated original source availability for those words | Source class |
| --- | ---: | --- | --- |
| Carla Nelson | **6** | **2022-10-06 16:15:31 UTC** (second independent original 2022 candidate page 16:48:45 UTC) | Original politician campaign platform 2022 |
| Ann Johnson Stewart | 4 | **2024-09-04 05:28:50 UTC** | Original politician campaign platform 2024 |
| Keri Heintzeman | 3 | **2025-04-24 16:32:55 UTC** | Original politician campaign 2025 |
| Michael Holmstrom Jr | 3 | **2025-08-26 22:26:50 UTC**, after same-day primary cutoff | Original politician campaign 2025 |
| Rob Kupec | 2 | **2026-10-10** current publisher response observed; page claims publication Oct 7, 2022 but no contemporaneous archival copy | Candidate-submitted questionnaire, NOT original campaign website |
| Michael Kreun | 2 | **2026-10-10** current publisher response observed; page claims publication Oct 19, 2022 but no contemporaneous archival copy | Candidate-submitted questionnaire, NOT original campaign website |

**Totals: six actual senators, twenty short attributed research leads; sixteen issue excerpts have original archived page public-by dates (six 2022, four 2024, six 2025); four are historically UNVERIFIED before Oct 10, 2026.** Every source retains a recorded independent retrieval/observation timestamp as well as its separately evidenced historical capture where available.

No person who cannot independently be documented to have served in the Minnesota Senate appears in the named report, even if that person ran for a Senate seat. If a candidate lost a prior election but the independent Minnesota LRL directory shows real Senate service at another point, that person may be included; losing alone is not a disqualifier.

Source originals: 2022 Carla Nelson [real archived original source run #38098726687](https://github.com/killjoy00/votepredict/actions/runs/38098726687), original 2024/2025 policy pages [source run #38086478508](https://github.com/killjoy00/votepredict/actions/runs/38086478508), 2022 politician-submitted questionnaire pages [source run #38089571113](https://github.com/killjoy00/votepredict/actions/runs/38089571113), official public actual Senate-service directory and 2025 special swearing original HTML [source run #38094976711](https://github.com/killjoy00/votepredict/actions/runs/38094976711).

## Trust controls

The unified source audit does NOT simply union JSON counts:
- Recompute SHA-256 for the LRL original directory and special-session swearing source and parse actual senator-service years/districts, including people sworn after 2025 special elections.
- Reopen BOTH ORIGINAL 2022 Carla Nelson archived page HTML byte bodies and prove each matches its own SHA-256, independent 2022 Wayback CDX SHA-1 base32 digest, exact original path/capture metadata. Require **all 12 issue-specific text occurrence checks** in the actual visible corresponding issue sections.
- Independently verify the other ten 2024–25 campaign source excerpts' pinned original historical capture dates and preserved previous original acquisition provenance.
- Keep all four Ballotpedia direct respondent snippets **2026-acquired-only**, with an independent 2022 publication date flag still false. A displayed 2022 headline is NOT a verified 2022 text-public-by date.
- Preserve actual source observation day, distinct author first posting date (unknown), archived capture no-later-than date, and refusal to classify source as automatically forecast-eligible.
- Exclude previously researched people without actual Senate service **without naming them**; no candidate lost-and-never-served text in output. No Neon/Vercel, production DB, model/retraining, evidence writes, cron or serving changes.

## Reproduction

Use the two public GitHub original-source ZIP artifacts above. All six original source CLI path arguments are mandatory:

\`\`\`bash
node --import tsx scripts/audit-senate-six-served-dated-campaign-sources-offline.ts \
 --official-lrl-original /sources/mn-lrl-official-senate-service-directory.html \
 --official-lrl-metadata /sources/mn-lrl-official-senate-service-directory-audit.json \
 --official-lrl-swearing /sources/mn-lrl-official-senate-special-swearing-history.html \
 --carla-2022-original-a /sources/carla-2022-page-a-wayback-20221006161531.html \
 --carla-2022-original-b /sources/carla-2022-page-b-wayback-20221006164845.html \
 --output /tmp/six-actual-senators-dated-campaign-position-source-ledger.json
\`\`\`

The GitHub Actions PR-only job \`.github/workflows/audit-senate-six-served-dated-issues.yml\` independently downloads original sources by pinned run ID, rechecks LRL and both historical Carla page byte identities, and saves a 30-day auditor-friendly artifact in exclusive private JSON. All original dates and 2026 retrieval dates remain separately identified; no source change or publication date assumption is permitted.

### Still outside this tranche

Most actual senator-serving people still have no original campaign issue page in our reviewed corpus. A complete **2021–2025 senator-by-year tenure denominator**, full original 2020/22 SOS filing candidate website fields, member-to-deployed-production-source evidence IDs, as-of bill/stance-level qualification and systematic campaign site archives are still required. **#864 stays OPEN**. The recovered issue-source excerpts have never been automatically admitted into historical forecasts.
