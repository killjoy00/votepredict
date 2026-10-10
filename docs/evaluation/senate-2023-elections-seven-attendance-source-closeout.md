# Issue #864 — seven original 2023 Elections meeting attendance records and ten roll actions

The [one-time original source run #38086725116](https://github.com/killjoy00/votepredict/actions/runs/38086725116), introduced by merged [PR #936](https://github.com/killjoy00/votepredict/pull/936), completed **successfully**, independently re-fetching exactly **seven original official 2023 Minnesota Senate Elections committee Minutes PDFs**. All seven original source PDF and embedded-text SHA-256 values match the previous original 2022–25 source audit. It re-extracted all **ten** preliminary named-roll source actions by **exact original PDF URL + hearing date + original text offset**, with zero source failures.

## Source result

| Independent source check | Result |
| --- | --- |
| Original PDFs reverified | **7 / 7** |
| Original provisional named-roll source offsets reverified | **10 / 10** |
| Opening meeting attendee headings uniquely list all fourteen senator surnames as present or absent | **7 / 7** |
| Printed meeting date inconsistent with indexed original hearing date | **0** |
| Explicit YEA/NAY choice attributed to member who is marked absent at that meeting's opening | **0** |
| A senator marked Present at the opening but Absent on a later roll-call motion | **1** |

The final case is the **March 14, 2023** meeting. Its opening minutes mark a member present who is separately **Absent at the recorded roll-call motion**. This must remain a **soft vote-time attendance discrepancy**, not a fabricated source error: a senator may be present at the meeting's start and absent later, and no original YEA/NAY choice was assigned to that person. The original opening attendance for January 17, February 14 and February 21 each had 13 present and one absent; February 7, March 2 and March 7 had all fourteen present; March 14 had 13 present and one absent. All dates were printed consistently in their original PDF headers.

The **permanent metadata-only source ledger** in [source-proof/senate-2023-elections-seven-original-attendance-ten-roll-ledger.json](./source-proof/senate-2023-elections-seven-original-attendance-ten-roll-ledger.json) retains the seven original PDF source URLs and exact PDF/text SHA, all ten original text offsets, the opening attendance present/absent counts, the date parity and a precise March 14 vote-specific review flag. New source result artifact ID **11682637939**, ZIP SHA256 **8d113cd7e34f9e99ab7b3a4e67893807e507d593234a66c2ed3e6b25b9c08cdd**, decoded JSON SHA256 **12cc2727e04eeb75e26d6602827bd43a1d8d1ac5d9001cce73a8bece40357ec5** are pinned to immutable tests. No senator source name-to-choice lists, complete original PDF or text is committed.

**Boundary:** Source-original attendance and source named-choice consistency increases confidence in the *recorded historical committee source*. It does not independently establish whether the senator was physically present when the vote occurred, exact unique bill/amendment motion identity, independent historical public-by timestamp for the document, authoritative full-member identity disambiguation or row equality in the private persisted member-vote database. The 2023 Feb 7 A36 vs oral amendment label remains ambiguous. No automatic ingestion, no final floor passage stance inferred.

Broader #864 gaps remain: 2025 Elections two wrong-date/absent-voter original source holds; 2021 print-only Senate official minutes, 2022 print/electronic differences, 141 electronic indexed meetings lacking original Minutes PDF links, and 138 media-player pages without playback/content attribution. No production/private database read/write, model, serving, forecast, training, scheduler or 2027 change, and no public office contact. **Keep #864 OPEN.**
