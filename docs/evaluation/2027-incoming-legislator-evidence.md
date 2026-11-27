# Incoming legislator evidence preparation (November 2026)

The owner prioritized collecting evidence for the newly elected members before opening day. Start with the approved projected 201-seat roster; compare its exact LRL person IDs with official 92nd, 93rd and 94th legislature directories (three bounded directory observations, not a repeat 201-page crawl). The incoming cohort is absent from the 94th. Separate returning members observed in either of the two earlier biennia from people without recent recorded service. Absence from these three directories is **not proof of no prior service**.

Initial pilot: reuse the official SOS candidate filing campaign registry, require exact approved election/LRL name and chamber/district/2026 filing date, and observe the candidate's own site and at most one linked issue/policy page. Reuse the original MHP/Habitat 2026 housing index and require exact candidate and chamber/district match for both House and Senate respondents; verify actual numbered answer text, not a submission form or blank response. Limit 40 targets, 125 public fetch calls, 24 MB accepted entity bodies and seven-minute pilot window, no retries or paid search. Unknown, ambiguous, blocked and unverified pages remain explicit gaps. No affiliation-based issue labels, no inferred endorsements or positions, no serving evidence, no database, Vercel, paid APIs or schedules.

Because this Git repository is public, the first report deliberately retains only source URLs, exact response digests, observation dates, short policy excerpts (maximum 22 words per campaign page), and verified questionnaire answer counts. Do not publish full publisher responses, raw registry pages, or incidental personal contact data in public Actions logs/artifacts or Git. Raw original-body retention and extraction into the private append-only evidence store require a separately verified protected collection role. A newly observed 2026 page cannot prove it was available before the actual observation date. Campaign site ownership is provisional from an exact official registry and public candidate-name match, not a verified historical snapshot.

Next: inspect actual gaps, target additional original publisher questionnaires, public candidate-authored statements and dated interviews, and verify public prior-office roll calls where applicable. Reuse the existing source parsers; do not pay for or duplicate historical Senate crawls. After term/membership activation, reconcile by stable LRL ID and exact seat; stage original bytes privately, validate publication and identity, and only then produce issue-position candidates using the existing frozen evidence admission rules. No model changes. The one-shot PR workflow is keyless and branch-specific; retire it after actual observations are durably recorded. Daily in-session evidence collection is a separate workstream from the preseason pilot.

## Verified first public-source pass

[Run 45909495973](https://github.com/killjoy00/votepredict/actions/runs/45909495973), job 140214137510, completed November 26 at 23:13 UTC. Prior LRL directories contained 201, 204 and 206 distinct identities; 51 projected 2027 members were absent from the 94th (33 House, 18 Senate), of whom 50 were absent from all three recent directories and one was returning. The [retained first-pass report](source-proof/2027-incoming-evidence-pilot-20261126-part1.json) records the 40-member pilot: 36 with at least one verified campaign source, 12 with actual housing questionnaire answers observed, 15 with short campaign policy excerpts, 73 total sources, five page failures, four members without verified sources. 83 public fetch calls and 22,249,891 accepted bytes. No raw bodies committed, no database or model activity. The next one-shot run restricts acquisition to the remaining 11 previously unattempted members using the exact retained cohort; it does not refetch candidate pages for the first 40.

## Verified second pass and combined coverage

[Run 45909823487](https://github.com/killjoy00/votepredict/actions/runs/45909823487), job 140215203795, completed on November 26 at 23:16 UTC. The [second-pass report](source-proof/2027-incoming-evidence-pilot-20261126-part2.json) records 11 previously unattempted members; 10 with verified sources, nine campaign sources by member, six housing respondents, one policy excerpt, 22 source receipts and two failures. Its roster hash matches the first pass, and its targets match exactly the remaining unattempted members of the original cohort; the two results sets are disjoint and cover all 51 identities. Combined: 46/51 have a verified source, 45 campaign sources by member, 18 housing respondents, 16 campaign policy excerpts by member, 29 with at least one short policy excerpt or verified questionnaire response, 17 with source links only and 5 with no verified source. 95 verified source receipts, 112 fetch calls, 32172960 accepted bytes and 7 page failures across both passes. These are observed source receipts, not model-ready evidence or a count of distinct issue positions. No serving evidence or production writes. The one-shot workflow has been retired; do not rerun the first two passes without new justification.

### Priority research backlog

First recover the five members with zero verified sources using original candidate questionnaires, dated attributed interviews and original public candidate statements. Then deepen the 17 source-only profiles. The other 29 profiles still need broader policy coverage, not automatic completion. Record absence and contradictory evidence explicitly; no party-based inference, private data, or changes to forecasting. Raw bodies must be privately retained and validated before any evidence promotion.

| Member | Seat | Current source status |
| --- | --- | --- |
| Aaron Schweiger | house:3B | No verified source |
| Jonathan Claussen | house:5B | No verified source |
| Dawn Loberg | house:13B | No verified source |
| Bradley Hennen | house:15A | No verified source |
| Simon Trautmann Cordova | senate:51 | No verified source |
| Tanja Goering | house:13A | Source only; no retained policy excerpt or verified questionnaire response |
| Abdi Daisane | house:14A | Source only; no retained policy excerpt or verified questionnaire response |
| Zachary Dorholt | house:14B | Source only; no retained policy excerpt or verified questionnaire response |
| Sara Bertschinger | house:20B | Source only; no retained policy excerpt or verified questionnaire response |
| Dominick Ronnenberg | house:23A | Source only; no retained policy excerpt or verified questionnaire response |
| Chad Westberg | house:30B | Source only; no retained policy excerpt or verified questionnaire response |
| Stacey Stout | house:33A | Source only; no retained policy excerpt or verified questionnaire response |
| Tom McKee | house:37A | Source only; no retained policy excerpt or verified questionnaire response |
| Hunter Cantrell | house:55B | Source only; no retained policy excerpt or verified questionnaire response |
| Austin Peterson | senate:4 | Source only; no retained policy excerpt or verified questionnaire response |
| Jared J. Gapinski | senate:13 | Source only; no retained policy excerpt or verified questionnaire response |
| Simon Glaser | senate:24 | Source only; no retained policy excerpt or verified questionnaire response |
| Cherie Johnson | senate:26 | Source only; no retained policy excerpt or verified questionnaire response |
| Samuel J. Rosemark | senate:44 | Source only; no retained policy excerpt or verified questionnaire response |
| Karla E. Hult | senate:50 | Source only; no retained policy excerpt or verified questionnaire response |
| Paul Cumings | senate:53 | Source only; no retained policy excerpt or verified questionnaire response |
| Mark O. Legvold | senate:58 | Source only; no retained policy excerpt or verified questionnaire response |
