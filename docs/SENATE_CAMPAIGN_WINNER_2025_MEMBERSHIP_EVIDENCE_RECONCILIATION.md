# Issue #864 C — archived campaign excerpt → official election outcome → existing Neon membership/evidence cross-check

This tranche ties **four original, hash-verified Senate campaign policy pages** from #939 to the correct *post-election candidate identities*, and adds a tightly gated direct-Neon READ ONLY reconciliation for three winning candidates. This is not an election-prediction feature or an evidence ingestion.

## Elections: exact SOS outcome identity

Six targeted official-publisher **unofficial general election results** are pinned in \`data/evaluation/senate-targeted-official-general-election-outcomes-2022-25-v1.json\`. An election result is retrospective; it was not available when the candidate was still running.

| Election/seat | SOS result winner | Defeated candidate | Candidate-written issue excerpts from authenticated archives |
|---|---|---|---|
| 2024 SD45 | **Ann Johnson Stewart** | Kathleen Fowke | 4 Stewart, 0 Fowke in this sample |
| 2025 SD6 | **Keri Heintzeman** | Denise Slipy | 3 Heintzeman, 0 Slipy |
| 2025 SD29 | **Michael Holmstrom Jr** | Louis McNutt | 3 Holmstrom, **3 McNutt, LOSING OPPONENT** |
| 2025 SD47 | Amanda Hemmingsen-Jaeger | Dwight Dorau | 0 issue-specific, authenticated statements in this sample |
| 2022 SD4 | Rob Kupec | Dan Bohmer | Separate candidate-response source leads, **not yet authenticated archived HTML** |
| 2022 SD32 | Michael Kreun | Kate Luthner | Separate candidate-response source leads, **not yet authenticated archived HTML** |

Source: [official 2022 Senate results](https://electionresults.sos.mn.gov/Results/Index?ersElectionId=149&scenario=StateSenate), [2024 SD45](https://electionresults.sos.mn.gov/Results/Index?ersElectionId=170&scenario=StateSenate), [2025 SD6](https://electionresults.sos.mn.gov/Results/Index?ersElectionId=184&scenario=StateSenate) and [2025 November specials](https://electionresults.sos.mn.gov/Results/Index?ersElectionId=187&scenario=StateSenate). Original certified canvass *bytes* have not been independently hashed by this source manifest, so it is precisely an SOS published **unofficial tallies** identity cross-check.

**Important:** a candidate's archive belongs to that candidate, *not* their district successor or victorious opponent. McNutt's three positions **must not** become Michael Holmstrom Jr's. A winner’s 2024/2025 campaign statements are still temporally eligible only after their verified archive capture (Sep 4 2024, Apr 24 2025, and Aug 26 2025). The election outcome used to join them cannot enter the historical as-of predictor.

Run the no-credential, no-network offline identity check:

\`\`\`bash
node --import tsx scripts/reconcile-senate-campaign-winners-offline.ts \
  --output /tmp/senate-campaign-winning-candidate-reconciliation.json
\`\`\`

Expected: **3 winning campaign identities / 10 short excerpt leads**, **1 losing campaign identity / 3 excluded**; **0** current DB membership joins (because the database has not been queried), **0** forecast evidence admissions. The script never conflates “not queried” with “zero stored evidence.”

## Existing Neon, separate owner-controlled read-only gate

The repository's [#847 evidence operating posture](https://github.com/killjoy00/votepredict/issues/847) disallows routine production Vercel access and refresh automation. The installed direct Neon connector has not worked in this interaction; a different **previously audited GitHub Actions existing-project Neon API GET pathway** is used instead, reusing \`src/operations/senate-media-neon-api-readonly.ts\`.

The one-time \`.github/workflows/audit-senate-campaign-neon-readonly-once.yml\` has **no push, pull request, schedule or workflow_dispatch trigger**, only an EXACT owner-comment trigger. The user explicitly agreed to **read-only** historical reconciliation but the GitHub repository owner still has to leave the exact approval marker:

\`\`\`
[campaign-864-neon-readonly-evidence]
\`\`\`

as a comment on [issue #864](https://github.com/killjoy00/votepredict/issues/864), **after the reviewed PR has merged to main**. The workflow verifies repository, comment actor, issue number, exact body, ref=main, and requires the protected \`evidence-readonly-sandbox\` GitHub Environment with the existing \`NEON_API_KEY\` secret and \`VOTEPREDICT_NEON_PROJECT_ID\` variable. If protections, permissions, credentials, or project ID fail, no SQL reads occur. No new database branch, compute, role, migration, secret or Vercel token is created.

If the protected environment permits execution, the code only:
1. Makes the **existing five GETs** to Neon API to verify an exact existing **VotePredict** project, existing default branch, database, endpoint, and in-memory connection URI. **This default branch is *not independently demonstrated to be the deployed production database***.
2. Opens one direct Postgres connection, sets driver/session default transaction READ ONLY, begins \`ISOLATION LEVEL REPEATABLE READ READ ONLY\`, verifies actual SQL database/role/transaction read-only flags and SELECT privileges.
3. Queries ONLY the 2025–26 **Senate districts 6, 29 and 45** membership identities and their campaign-site issue position count, with Jan 1 2026 published-before cutoff. Max **12** membership rows, else abort on overflow.
4. Queries ONLY the existing campaign-site \`contextType=issue_position\` evidence rows within those districts, max **300**, else abort. It uses any DB excerpt body *in memory* for exact-short-excerpt comparisons (10 winning excerpts only); original raw DB excerpts/claims are never logged or exported.
5. Enforces identity by **normalized senator name + district + 2025–26 session + elected-vs-defeated outcome + membership active dates**. Source SHA-256 and exact-excerpt boolean matches are metadata-only comparison; no new source is inserted.
6. \`ROLLBACK\` even on error, closes the connection; only a bounded private 14-day GitHub artifact with membership IDs and existing campaign evidence metadata is retained.

**Do not misstate role privileges:** the existing Neon default branch may expose an owner SQL role with general write grants. Only this actual **transaction** is READ ONLY; it is not claiming a dedicated SQL SELECT-only role. The protected isolated sandbox workflow in issue #847 is a separate proposed posture and is not silently used here. The default Neon branch must also not be declared the same as deployed Vercel production without separate verification. If no actual run has completed, candidate memberships / production evidence completeness remain **unknown**.

## Follow-on 2020–2022 original source acquisition

The same outcome ledger records two contemporaneously dated, first-person campaign questionnaires—[2022 SD4 Rob Kupec and Dan Bohmer](https://news.ballotpedia.org/2022/10/07/all-candidates-for-minnesota-state-senate-district-4-complete-ballotpedias-candidate-connection-survey/) and [2022 SD32 Michael Kreun and Kate Luthner](https://news.ballotpedia.org/2022/10/19/all-candidates-for-minnesota-state-senate-district-32-complete-ballotpedias-candidate-connection-survey/). These belong to a **publisher candidate questionnaire** evidence class, not a politician's own campaign website. Their on-page dates have not been independently confirmed as an earliest historical public-by; retrieve matching original 2022 Wayback/Common Crawl bytes separately before considering replay eligibility.

The original Minnesota Secretary of State candidate-file **filing exports** from 2020 and 2022, with the 16th campaign website field, remain missing. Election-result seven-column \`cand.txt\` contains **no campaign website field**, even though the *file layout* describes the distinct SOS filing-export schema. A 2026 live SOS list or a 2022 result summary cannot serve as original 2020/22 filing data. The statewide 2021–25 Senate campaign-site denominator remains **uncertified**. No public-office contact or record request will be made.

All source/election/membership work in this PR is **audit-only**. #864 stays OPEN; **no production read or write is claimed until actual authorization and proof**, and no serving, model/retraining, scheduled evidence job or frozen evaluation is changed.
