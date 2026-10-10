# #864 C — Minnesota Senate historical campaign-website discovery inventory

**Scope:** evidence-source discovery, 2021–2025 calendar years. Pure static source manifest + credential-free offline parser and optional membership gap prioritization. This is NOT a certified Minnesota SOS campaign-filing universe, production database scan, historical page authentication, or proof of any candidate's 2021–25 issue statement.

## Acquired public source leads

Manifest: \`data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json\`.

| Layer | Independently observed source | Records | Actual websites from source | What it proves |
|---|---|---:|---:|---|
| 2020 state Senate general results | Minnesota SOS unofficial returns | 67 winning election-district entries | 0 (the results do not carry URLs) | Post-election candidate identity and race district, not a pre-election statement |
| 2022 state Senate general results | Minnesota SOS unofficial returns | 67 winning entries | 0 | Same; not the full set of filed candidates |
| 2024–2025 Senate special results | Minnesota SOS unofficial returns | 5 additional winning entries (2024 SD45; 2025 SD60, SD6, SD29, SD47) | 0 | Special-election candidate identity; not an exhaustive tenure roster |
| 2025 SD60 and SD6 official filing-list pages | Minnesota SOS historical special-election pages | 10 + 9 named candidates, including losing primary candidates | 0 **visible on page** | Listed filed candidates as of the page's stated as-of date, not a website-absence certificate |
| 2024 SD45 and 2025 SD6 / SD29 / SD47 campaign websites | Minneapolis Labor Review, Lakes Area Vote, Minnesota Reformer | 6 direct campaign-page links | 6 **publisher-linked leads**, not original SOS filing URLs | Historical research leads requiring independent original-page verification |

**Total: 139 winner/election observations, 19 SOS-filed candidate-list observations, and 6 publisher-carried website URL leads (five from dated articles, one from a voter-guide page without independently established historical page timing).** These counts overlap persons and races: NEVER add them to obtain distinct persons, campaign committees, membership denominator, all candidates, or campaign-platform completeness.

Sources:
- SOS Nov 3 2020 statewide Senate results: https://electionresults.sos.mn.gov/Results/Index?ersElectionId=136&scenario=StateSenate
- SOS Nov 8 2022 statewide Senate results: https://electionresults.sos.mn.gov/Results/Index?ersElectionId=149&scenario=StateSenate
- SOS Nov 5 2024 SD45 special: https://electionresults.sos.mn.gov/Results/Index?ersElectionId=170&scenario=StateSenate
- SOS Jan 28 2025 SD60 special: https://electionresults.sos.mn.gov/Results/Index?ersElectionId=178&scenario=StateSenate
- SOS Apr 29 2025 SD6 special: https://electionresults.sos.mn.gov/Results/Index?ersElectionId=184&scenario=StateSenate
- SOS Nov 4 2025 SD29+47 specials: https://electionresults.sos.mn.gov/Results/Index?ersElectionId=187&scenario=StateSenate
- SOS SD60 filed-candidate page (listed as of Jan 2 2025): https://sos.mn.gov/election-administration-campaigns/elections-calendar/senate-district-60-special-election/
- SOS SD6 filed-candidate page (listed as of Apr 2 2025; withdrawn candidates excluded): https://www.sos.mn.gov/election-administration-campaigns/elections-calendar/senate-district-6-special-election/
- Minnesota Reformer Nov 4 2025 campaign-link article: https://minnesotareformer.com/2025/11/04/today-is-election-day-make-your-voice-heard/
- Minneapolis Labor Review Aug 12 2024 candidate site citation: https://minneapolisunions.org/news/ann-johnson-stewart-labor-endorsed-SD-45
- Lakes Area Vote 2025 candidate voter guide, historic page publication date independently unproven: https://lakesarea.vote/keri-heintzeman/
- SOS historical candidate-file format: https://www.sos.mn.gov/media/2513/candidate-files-layout.txt

Important historical limitation: the live SOS candidate finder currently presents the **2026** election. That file or today's updated campaign pages cannot be retroactively treated as records public in 2020, 2022, 2024 or 2025. The official SOS semicolon-delimited historical candidate file describes a \`Campaign Website\` field (index 15, field 16) for federal/state/county offices, but the layout document is **not** itself an original historic filing export. The source warns that fields can change before election day. We did not download any 2020/2022 original filing file or prove a public timestamp for its campaign website fields in this tranche.

Publisher-carried links identified in 2024–2025 source material:
- Amanda Hemmingsen-Jaeger: https://amandaformn.com/
- Dwight Dorau: https://votefordwight.com/
- Michael Holmstrom Jr: https://www.mike4mnsenate.com/
- Louis McNutt (November 2025): https://louismcnuttformnsenate.com/
- Ann Johnson Stewart (August 2024): https://annjohnsonstewart.com/
- Keri Heintzeman (2025 voter guide, independently proven publication time **unknown**): https://heintzemanforsenate.com/

These are **publisher-link discoveries only**. A publisher's printed date is distinct from the independently proven public-by date of the article and distinct from the candidate's original website page date. Neither a candidate position nor pre-vote eligibility is established by these leads. Current mutable campaign pages must NEVER be backdated.

## Running offline without any production credentials

\`\`\`bash
node --import tsx scripts/audit-sos-senate-campaign-inventory-offline.ts \
  --output /tmp/senate-sos-website-seeds.json
\`\`\`

This writes an immutable \`0600\`-mode JSON report with all 139+19+6 discovery observations represented in counts, **zero memberships ranked**, and \`zeroRecordedPositionMemberships=null\`. No database or network is accessed. This is expected: aggregate evidence counts from #477 cannot identify the precise Senate membership UUIDs with zero records.

To rank the most important membership gaps, obtain a separately authorized, **SELECT-only**, complete membership export (script is NOT run automatically):
\`scripts/sql/senate-2021-25-campaign-issue-priority-select-only.sql\`.

The query returns \`membershipId\`, \`senatorName\`, \`sessionSlug\`, \`district\`, \`recordedIssuePositionItems\`. The count is *recorded timestamped items within the relevant historical session window*, not a claim of all positions that may have existed. The 2025–26 cohort is capped at **December 31, 2025**, excluding 2026 captures, and future archive timestamps are not treated as earlier proof. Export those results as **JSONL** (one JSON object per line), and run:

\`\`\`bash
node --import tsx scripts/audit-sos-senate-campaign-inventory-offline.ts \
  --memberships /path/to/authorized-senate-memberships.jsonl \
  --output /tmp/senate-sos-website-priority.json
\`\`\`

Rows with \`recordedIssuePositionItems=0\` sort first. Only exact normalized candidate name + election district + compatible election/session may attach a winner identity or one of the six publisher URL leads. Any uncertain alias, redistricting, candidate-vs-member identity, or vacancy is an explicit failed join, never a guessed match. A zero stored item count means **no stored qualifying evidence in that period**, not absence of a political position.

## Optional **archived** SOS semicolon text file

If an original relevant-year official \`Federal, State, and County Candidates\` semicolon file is separately acquired, pass its copied bytes **only after separately verifying the source and its historical provenance**:

\`\`\`bash
node --import tsx scripts/audit-sos-senate-campaign-inventory-offline.ts \
  --candidate-file /path/to/sos-2022-candidates-original.txt \
  --file-year 2022 \
  --file-source-url https://www.sos.mn.gov/your-exact-reviewed-original-url \
  --memberships /path/to/authorized-senate-memberships.jsonl \
  --output /tmp/senate-sos-website-with-file.json
\`\`\`

No web request or live DB query is made. The parser keeps only Senate candidate name, district, website, locally computed file SHA-256, and a public file source URL. It intentionally drops **all private or extraneous address, phone, and email fields**. Non-website/email-like entries remain invalid or blank, never "no website exists." Even if a caller asserts historical capture provenance, the tool itself cannot independently authenticate source bytes and therefore **never grants a historical public-by timestamp or forecast eligibility**.

Inputs capped: manifest 4 MiB; membership JSONL 16 MiB and 1,000 records; candidate file 32 MiB. Outputs cannot overwrite any existing file; no scheduler, production DB, frozen artifact, or active Wayback collector is modified.

## Further work / acceptance debt

1. Recover independently archived **original 2020 and 2022 SOS filing exports** and any historically date-proven 2024/2025 special candidate spreadsheets, with source/content hashes. Track all actual Senate filers including primary losers, withdrawals, write-ins, missing campaign URLs, and source unavailability; historic general-election winners are just a priority seed cohort.
2. With explicit owner authorization, perform the SELECT-only membership export and produce **named, membership-UUID-level P0 lists**. Current 2021–22 / 2023–24 / 2025–26 #477 aggregate "no evidence" counts are not directly usable as a 2021–2025 person-level denominator.
3. Reconcile archived campaign sites, domain redirects/defunct hosts, issue/page changes, exact original statement excerpts, SHA-256 of original bytes, and independently proven earliest available-by timestamps using #902 and #906 tools. Post election-result identities are discovery-only and cannot be counted as pre-election platform publication evidence.
4. Reconcile every verified original page to a SELECT-only evidence/source-document export. Revisit collection only in separately approved, non-serving batches. No historical model eligibility, retraining, or 2027/production behavior change under this issue.

**Never close #864 based on these preliminary source links alone.**
