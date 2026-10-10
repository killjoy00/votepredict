# #864 C: 2022 direct candidate questionnaire excerpts, verifiable respondent attribution (not campaign-site sources)

## New evidence leads, split by winner versus defeated opponent

The October 7 and October 19, 2022 Ballotpedia News articles report quotes submitted by actual Minnesota Senate candidates during the 2022 general-election campaign. PR #948 **downloaded and retained actual 2026 publisher article HTML bytes**, with pinned SHA-256s and acquisition run #38089571113, artifact 11683038599.

Eight deliberately **short, original-HTML speaker-section excerpts** are mapped to the explicit heading immediately before the candidate's response. Excerpts are not inferred from the article introduction, source page title, party affiliation, endorsements or someone speaking about a candidate.

| SOS 2022 general race | Winner with own statements | Losing candidate, excluded from senator history | Sample statement issue families |
|---|---|---|---|
| SD4 | **Rob Kupec**, 2 excerpts | **Dan Bohmer**, 2 excerpts | education, health; taxes, public safety |
| SD32 | **Michael Kreun**, 2 excerpts | **Kate Luthner**, 2 excerpts | transportation, taxes; education, reproductive health |

Source: [2022 SD4 Ballotpedia News](https://news.ballotpedia.org/2022/10/07/all-candidates-for-minnesota-state-senate-district-4-complete-ballotpedias-candidate-connection-survey/), [2022 SD32 Ballotpedia News](https://news.ballotpedia.org/2022/10/19/all-candidates-for-minnesota-state-senate-district-32-complete-ballotpedias-candidate-connection-survey/). Winner/loser labels are **post-election identity outcomes**, not public pre-vote predictors, independently checked against existing [SOS official-result identity observations](../data/evaluation/senate-targeted-official-general-election-outcomes-2022-25-v1.json).

### What this tranche proves

- The text was in the **publisher HTML downloaded October 10, 2026**, with pinned raw SHA-256s \`c1d0945bbcf87a0448f94a05509c65cb02202b49ed037765d6091ecfd64df038\` for SD4 and \`a09ef6bfb9804fa885579906746a38c0fde444d4466bd000b6ea65e997793ac8\` for SD32.
- Eight short exact issue phrases can be found **within the explicitly labeled respondent sections**, not merely elsewhere in the article. The validator rejects duplicated/missing headings, changed HTML bytes or candidate-outcome contradictions.
- Respondent quotations are **publisher-hosted candidate surveys**, NOT a campaign candidate-owned website source and NEVER \`sourceSubtype=campaign_site_page\`. They belong to a distinct provenance class.
- The Ballotpedia publishers label the articles **October 7, 2022** and **October 19, 2022** respectively. Both dates precede the November 8 election, but the retrieved original bytes are **2026 content**. The first #948 historical Wayback exact-URL index checks returned zero matching 2022 CDX capture rows. **No independent 2022 earliest-public-by evidence is established.** A later current website date cannot authorize pre-election replay.
- Of the eight excerpts, **four candidate-written statements belong to election winners**, and **four are nonwinner statements** which must stay excluded from these winners' membership records. All eight remain **forecast-ineligible** until independent historical page/capture date verification, issue relevance, and source-to-database reconciliation. No model/production evidence is touched.

### Repeatable offline source audit

The PR job \`.github/workflows/verify-senate-2022-survey-originals.yml\` internally fetches ONLY the pre-existing public source artifact by immutable GitHub run #38089571113, never a secret DB, and checks the exact downloaded HTML bytes and four respondent headings. It saves a sanitized, private, **14-day verification artifact** containing the eight brief excerpts, named speaker, winning vs losing outcome, website-source class and unverified historical availability. The full original publisher article bytes remain in the earlier acquisition source artifact (30-day retention).

Local reproduction after extracting the *original* #948 source artifact:

\`\`\`bash
node --import tsx scripts/audit-senate-2022-candidate-surveys-offline.ts \
  --sd4 path/to/2022-sd4-ballotpedia-article.response \
  --sd32 path/to/2022-sd32-ballotpedia-article.response \
  --output /tmp/senate-2022-survey-audit.json
\`\`\`

Omitting both input files emits a clearly labeled **ledger-only / unverified in this run** report. Providing only one or any modified source file fails. The output is \`0600\` and cannot overwrite originals.

### Open work

Search independent **historical** 2022 original article/page captures (Wayback/Common Crawl) and candidate-owned campaign sites. Neither the publisher's current response nor an undated indexed candidate profile should be backdated to election day. The 2020/2022 original SOS *filing-export* website column remains unproven. Do not contact state offices. Keep #864 open.
