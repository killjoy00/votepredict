# Issue #864 — Dated Minnesota Senate service-only campaign source inventory

## Eligibility of people: actual state senators, not simply candidates

**The target population is anyone independently documented as having served in the Minnesota State Senate.** If someone lost an earlier election but served in the Senate at any later point, their older campaign material can still be researched. Someone who never served should **not** appear in a senator-focused report, even if their campaign page was once downloaded for race-context or source-validation reasons.

This rule is now enforced by checking *both* the official Minnesota Secretary of State election observation and the official [Minnesota Legislative Reference Library Senate service directory](https://www.lrl.mn.gov/legdb/senate_dir). The one-shot runner captures the **actual original LRL HTML bytes** with a retrieval timestamp and SHA-256, then joins the directory service-year/district to the election result name/district. It requires unambiguous **first + last name, district and overlapping legislative service year**. No generic edit-distance, district-only candidate linking, automatic winning-opponent transfer or House-only service is sufficient.

If a winner name cannot be verified in that independent directory, that observation is **excluded anonymously** from the named output pending manual resolution; this does **not** prove the person failed to serve. The report keeps a count of excluded/unresolved election observations but **never includes their personal names in the senator-only output**. The source directory is an "ever served" verification source; a complete 2021–2025 term-by-term roster still needs separate membership reconciliation.

The two SOS original government general-election sources per election yield a bounded **139 election-winner observation** input set: 67 in 2020, 67 in 2022, one 2024 special, and four 2025 specials. These **are not** 139 distinct senators or a proof every winner was seated. Each candidate is admitted into the *named coverage output* only after LRL service verification. The original SOS seven-column result-candidate lookup is not the separate 21-column SOS candidate *filing export* containing historical campaign Website.

## Dating every actual observation, conservatively

We record at least one **evidenced date for each item**; a historical date is only used when supported by original bytes.

| Source classification | Minimum dated observation | Earliest historical "public by" we may actually assert |
| --- | --- | --- |
| 2020/2022 original election result data downloaded in #948 | **2026-10-10** (source actually retrieved) | Not pre-vote: election day is the race date, not a publication proof |
| Official LRL Senate service directory | The runner's exact **UTC retrieved-at timestamp**, never earlier than 2026-10-10 for this new capture | Member service years are shown on the official page; page publication date itself is not backdated |
| Current publisher/carried campaign website or questionnaire page downloaded in 2026 | **2026-10-10** | 2026-10-10 unless independently authenticated older response bytes exist |
| Candidate-owned campaign issue HTML with independently corroborated Wayback CDX digest and actual original page bytes | **2026-10-10** as acquisition day, **plus** exact historical capture timestamp | **2024-09-04** (Stewart SD45), **2025-04-24** (Heintzeman SD6), **2025-08-26** (Holmstrom SD29) for the first verified issue-bearing versions *in the reviewed sample* |

**Never substitute article headline date, election date, winning status, original web domain's age or current retrieval date for a pre-election publication timestamp.** A historical archive proves the exact text was publicly accessible **no later than its capture**, not the author's first posting date. Any 2026-only statement cannot be used at a 2020/2022/2024/2025 as-of forecast cutoff. The report includes \`candidateAuthoredIssueFirstAttestedPublicBy\`, \`candidateAuthoredIssueDateEvidenceBasis\`, \`candidateAuthoredIssueTextRetrievedOn\` and \`officialElectionResultOriginalBytesRetrievedOn\`; absence of text is represented by a null *issue date*, not by an invented date.

## Actual source coverage and what remains

Among the **139 input winning-election observations**, the existing reviewed corpus holds four publisher-carried campaign website leads and independently archived candidate-owned policy pages for three winning candidates, containing ten brief issue excerpts. Two senators who won in 2022 have four 2026-retrieved publisher questionnaire excerpt leads, **not independently attested by any 2022 archive in this sample**.

The actual **senator-only numerator and individual names must be taken from the current LRL-verified report**, not from the raw 139 result observations. A missing LRL match reduces the *verified named subset* rather than proving a person's never-served status. Missing a campaign page in the reviewed corpus does not prove the person had no policy or website.

The previously acquired samples also include campaign pages or publisher quotes attributed to people who were not elected in those races. Those source bytes may be retained as immutable acquisition context but **do not appear in senator-facing coverage reports** unless the individual independently qualifies as having served in the Senate *at some point*. We will not spend further source-acquisition work on confirmed never-served people.

## Reproducible source-only verification

The PR-only \`.github/workflows/audit-senate-statewide-campaign-sources.yml\` executes:

1. Download the four original 2020/2022 SOS public government result files from [public source run #38089571113](https://github.com/killjoy00/votepredict/actions/runs/38089571113). Rehash and verify all 134 general-election winner identities, 67 districts per general election, with **post-vote identity only** semantics.
2. Download the official public [LRL Senate service directory](https://www.lrl.mn.gov/legdb/senate_dir), save original HTTP 200 HTML bytes and an exact acquisition-time \`observedAt\` and SHA-256. Reject wrong body/oversized files/invalid date.
3. Reopen and rehash the saved directory with the reported UTC observation time; independently check documented Senate service for each potential named entry. Emit **only documented people**, with session/district/year evidence. Leave ambiguous/unmatched winner observations anonymous.
4. Save sanitized source/dating/coverage JSON and original public LRL directory artifact for 30 days.

No confidential data or credentials, production database, Neon/Vercel, scheduled evidence collection, source insertion, model/training or live forecast changes occur.

Offline:
\`\`\`bash
node --import tsx scripts/audit-senate-statewide-campaign-source-coverage-offline.ts \
 --2020-st /sources/2020-sos-general-stsenate.response \
 --2020-cand /sources/2020-sos-general-cand.response \
 --2022-st /sources/2022-sos-general-stsenate.response \
 --2022-cand /sources/2022-sos-general-cand.response \
 --official-senate-service-html /lrl/mn-lrl-official-senate-service-directory.html \
 --official-senate-service-metadata /lrl/mn-lrl-official-senate-service-directory-audit.json \
 --output /tmp/verified-ever-served-senator-campaign-source-gaps.json
\`\`\`

No LRL proof input = **zero named senator records**, plus anonymous unresolved observation counts. Any supplied original source must match the stored SHA-256, and all outputs are exclusive/non-overwriting \`0600\`.

This is not yet a complete year-by-year Senate membership census. Earlier campaign statements from people who *eventually* became senators are eligible for research; they still require their own attested public-by dates before historical prediction use. #864 remains **OPEN**.
