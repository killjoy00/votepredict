# Issue #864: Public-only 2020/2022 Senate candidate-source acquisition

This builds on #947's confirmed Senate general election candidate outcomes and #932's archive-byte verification workflow. This is a **live, bounded, one-shot acquisition**, not another URL planning-only ledger. The GitHub Actions job uses public HTTP only, **no secrets, Neon/Vercel, production data, source inserts, scheduling, forecasts or models**.

## Original sources requested

- Official Minnesota Secretary of State post-election \`stsenate.txt\` and seven-column \`cand.txt\` lookup for **2020-11-03 and 2022-11-08**:
  - \`https://electionresultsfiles.sos.mn.gov/20201103/stsenate.txt\` and \`.../cand.txt\`
  - \`https://electionresultsfiles.sos.mn.gov/20221108/stsenate.txt\` and \`.../cand.txt\`
- Ballotpedia's October **7**, 2022 [SD4 Kupec/Bohmer candidate-written questionnaire excerpts](https://news.ballotpedia.org/2022/10/07/all-candidates-for-minnesota-state-senate-district-4-complete-ballotpedias-candidate-connection-survey/) and October **19**, 2022 [SD32 Kreun/Luthner candidate-written questionnaire excerpts](https://news.ballotpedia.org/2022/10/19/all-candidates-for-minnesota-state-senate-district-32-complete-ballotpedias-candidate-connection-survey/). Both 2022 winners and losing opponents must be kept separate.
- An exact-page **2022-only** Wayback CDX search for each Ballotpedia published URL, restricted to captures **strictly before** the November 8, 2022 general election, followed by the oldest and newest distinct pre-general indexed archive snapshots (at most two per article). Save a historic snapshot as an authenticated original page **only if** its actual HTTP 200 bytes' base32 SHA-1 hash matches the separately acquired original Wayback CDX digest.

This permits a useful 2020/22 official candidate-result identity denominator but does **not** confuse it with a historically published SOS **filed-candidate 21-column website export**, which has not yet been recovered. The published official \`cand.txt\` files have no campaign website; a parsed file layout or a 2026 candidate finder does not establish 2020/22 filed website histories.

The two Ballotpedia articles present first-person candidate-submitted issue priorities, but are **publisher questionnaire** sources, not the candidate's own campaign website. The on-page 2022 date alone is not a cryptographic first-public-by proof, even if the current 2026 HTML loads successfully. The historical CDX index itself also does not prove original archived bytes or direct candidate attribution.

## Acquired artifact and verification

The internal PR triggers \`.github/workflows/acquire-senate-2020-22-public-originals.yml\` *once*, with no scheduled, push-to-main or production-triggered collector. The bounded runner saves:
- HTTP status (including 403/404/429/5xx), requested URL, 2026 retrieval date, current response headers, original response SHA-256 and bytes, or a failure reason.
- Real source body files only for successful HTTP 200 downloads; historical archive HTML snapshots only when actual page bytes match the separate prior-election CDX digest.
- A manifest that distinguishes original post-vote SOS ballot tables, live-current publisher responses, historic Wayback candidate-answer snapshots, and unavailable/mismatched records.
- At most six direct public pages, two CDX matrix queries, and four bounded Wayback snapshot downloads; timeout **18 seconds** each; 2 MiB per response; exclusive new private local output path; 30-day GitHub artifact retention.

Any missing or inaccessible file means **not recovered during this bounded run**, never no candidate/no website. Source ZIP and hashes can be reviewed without running production queries. Candidate questionnaire excerpts must be precisely attributed to the speaking respondent in the original acquired text and pass as-of election cutoff audits before being proposed for offline issue-evidence reconciliation.

## Outstanding

Historic SOS **filing exports** from 2020 and 2022 with the actual campaign website field, complete 67-district candidate/website counts, complete 2021–25 seated senator roster, earlier 2020 campaign issue platform captures, and any owner-approved existing Neon read-only row reconciliation are all separate, explicitly open debts. The results files provide candidate outcome observations only, not source availability. Do not contact election/legislative offices: public self-service only. Keep [#864](https://github.com/killjoy00/votepredict/issues/864) OPEN.
