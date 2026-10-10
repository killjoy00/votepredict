# #864 C — 2025 Senate special-primary identity and filing reconciliation

**Scope:** independently viewed public Minnesota Secretary of State election-result pages / primary candidate lookup files, calendar year **2025 only**. This is the first candidate-by-candidate official special-primary result inventory for all four 2025 Senate special-election districts. All inputs are static, the tool runs fully offline, and no original campaign platform is claimed.

## What was actually checked in

\`data/evaluation/senate-2025-special-primary-candidate-observations-v1.json\` contains the candidate names *as listed by the official SOS election results*:

| Election | SOS source | District | Candidate records | Identity fields |
| --- | --- | --- | ---: | --- |
| Jan 14, 2025 | https://electionresults.sos.mn.gov/Results/Index?ersElectionId=177&scenario=StateSenate | 60 | **9** | name/district/party |
| Apr 15, 2025 | https://electionresults.sos.mn.gov/Results/Index?ersElectionId=183&scenario=StateSenate | 6 | **9** | name/district/party |
| Aug 26, 2025 | https://electionresults.sos.mn.gov/Results/Index?ersElectionId=190&scenario=StateSenate and https://electionresultsfiles.sos.mn.gov/20250826/cand.txt | 29 | **4** | name/district/party, SOS candidate ID + office ID |
| Aug 26, 2025 | same official SOS text file | 47 | **3** | name/district/party, SOS candidate ID + office ID |

**25 primary-candidate observations, four Senate districts, three election dates.** This is not 25 distinct campaigns with websites; it is also not a full historical list of all 2025 candidates who filed, later withdrew, or never appeared in primary results.

Comparison to [the 2020–25 SOS results/winner and 2025 SD6/SD60 filed-candidate inventory](../data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json):

- Four candidate identities exactly match the eventual general-election winners: **Doron Clark (SD60), Keri Heintzeman (SD6), Michael Holmstrom Jr (SD29), and Amanda Hemmingsen-Jaeger (SD47)**.
- The other **21** names were observed in primary results, but they are **not all losing primary candidates**; some were general-election nominees.
- The SOS SD60 original filed-candidate page lists **10** people; the Jan 14 result table includes **9**. **Mohamed Jama** appears in the filed-candidate page but not these primary result rows. Disposition is **unresolved**, *not* automatically "withdrawn", "did not file", or "no campaign website". The SD6 filed-candidate list and result rows both include the same nine names. SD29 and SD47 still lack the complete historically archived official filing-list denominator.
- **Five** of the six previously inventoried publisher-linked campaign URLs match candidates in the 2025 special-primary roster (Keri Heintzeman; Michael Holmstrom Jr; Louis McNutt; Dwight Dorau; Amanda Hemmingsen-Jaeger). **Ann Johnson Stewart** has the sixth lead, from her **2024 SD45 special campaign**, not one of these 2025 primary races. All remain separate unverified discovery leads, not SOS-supplied URLs.

### What the original source really contains

The SOS 2025 SD29+47 \`cand.txt\` candidate table uses **seven columns**:
\`candidate ID; name; office ID; office title; county ID; party code; party abbreviation\`. These rows are publicly readable in the linked original file, and the SOS media index confirms the original link:

https://electionresults.sos.mn.gov/Select/MediaFiles/Index?ersElectionId=190

It has **no campaign website field** and **no political statement excerpt**. The direct SOS pages for SD60 and SD6 show only candidate names, parties and vote totals, not source IDs or websites. We have transcribed the names and SOS candidate IDs, not downloaded and hashed original government response bodies, nor certified original disclosure time by a timestamped independent archive.

This candidate lookup is NOT the separate original SOS candidate-filing export where \`Campaign Website\` is field 16. Do not read \`cand.txt\` as \`candidate-files-layout.txt\` or infer a website from any position.

### Offline reconciliation

\`\`\`bash
node --import tsx scripts/audit-senate-2025-special-primary-offline.ts \
  --output /tmp/2025-senate-special-primary-audit.json
\`\`\`

The output lists all observed primary candidates, four winner matches, 21 other observations, separate publisher campaign URL leads, the precise one-name SD60 filing-to-primary discrepancy, and explicitly unknown person-level coverage without an export.

Optional independent local SOS \`cand.txt\` comparison:

\`\`\`bash
node --import tsx scripts/audit-senate-2025-special-primary-offline.ts \
  --candidate-file /path/to/reviewed-20250826-cand.txt \
  --output /tmp/2025-senate-primary-local-identity-comparison.json
\`\`\`

This compares all seven SOS candidate IDs/names/parties from the local file against the checked-in static manifest, rejecting any malformed, duplicate or extra rows. It **does not** authenticate original bytes or historical publication timestamp. Original government bytes/source retrieval must be separately attested and hashed.

An explicit-owner-authorized historical **SELECT-only** member JSONL export can be passed with \`--memberships\`; the format and the unexecuted SQL are documented at \`scripts/sql/senate-2021-25-campaign-issue-priority-select-only.sql\`. Ranking filters to \`2025-2026\` memberships and historically recorded 2025 campaign-site issue-position items. Without it the metric remains \`null\` (unknown), never zero.

The tool is credential-free, network-free, read-only with respect to inputs, output \`0600\` and exclusive \`wx\`. No Vercel/Neon access or backfill activation; no extraction into forecasts or changes to the model. All 2025 campaign policy statements still need independent original-site capture timestamp, text hash, candidate attribution and vote cutoff before any historical forecast eligibility claim.

## Remaining tasks

1. Independently prove the availability and original bytes of 2025 candidate URLs/issue pages (Wayback CDX versions with digest and capture time, then #902/#906); **do not backdate today's live candidate pages**.
2. Obtain 2025 SD29+47 original filed-candidate inventory and reconcile all primary/general candidates, removals and election availability.
3. Get historical candidate-filing website-field exports from 2020/2022 and resolve 2020 primary data; official post-election source lists cannot substitute.
4. Only after separately authorized SELECT-only export, identify precise 2021–25 membership zero-site-issue gaps. Do not conflate 2026 live content with 2025 archive proof.
5. Keep #864 OPEN until statewide source-denominator and item-by-item evidence reconciliation are independently verified.
