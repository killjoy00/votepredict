# #864: verify the other thirteen 2025 Elections named original roll candidates against four dated opening rosters

**Source-only audit (2026-10-10); do not infer production historical member-vote rows.**

The independent [2025 Elections 15-roster original ledger](./source-proof/senate-2025-elections-fifteen-historical-roster-source-ledger.json) established 15 original source named-roll candidates (163 explicitly named source choices) across six original PDFs, all matching the historically published 11-member roster after Feb 3 (excluding Bill Weber). [PR #963 and the corresponding permanent proof](./senate-2025-elections-two-held-original-source-closeout.md) have separately SHA-verified the two special source-date cases (Feb13, Mar27), accounting for **20** source named-choice tokens. They remain HOLD for certification.

The **remaining four original meeting PDFs** collectively contribute precisely **13 provisional named roll candidates, 143 individually explicit source-choice tokens**, none of which has yet been independently crosschecked against its own original opening Present/Absent roster:

| Original hearing | Original pinned source offsets | Provisional source-roll candidate count |
| --- | --- | ---: |
| [2025-02-06 Elections](https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250206/Elections_20250206_Minutes.pdf) | 1574, 1991, 2250, 2522, 2946 | 5 |
| [2025-02-11 Elections](https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250211/Elections_20250211_Minutes.pdf) | 2354, 3460 | 2 |
| [2025-03-25 Elections](https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250325/Elections_20250325_Minutes.pdf) | 1326 | 1 |
| [2025-04-08 Elections](https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250408/Elections_20250408_Minutes.pdf) | 2133, 2401, 2673, 2941, 3303 | 5 |

This bounded audit reuses (not replaces) the original independent strong-roll source manifest run **38075573031**, original matching named source run **38079646647**, exact permanent **19-tally-matched queue**, and the official [historical 94th Elections committee roster](https://www.lrl.mn.gov/timecapsule/commmembers?body=s&comtecode=10073&sess=94&subcomtecode=0). A new *one-time* [GitHub Actions source workflow](../../.github/workflows/senate-2025-elections-four-originals-thirteen-attendance.yml) re-fetches only these four original SHA-pinned PDFs (3 MiB/30 page bounds, no redirects), re-verifies original PDF bytes and parsed text SHA256, tests all 13 exact original text offsets and numeric named roll matches, verifies that each original meeting's opening Present/Absent rosters together partition all 11 historical committee members, and compares each explicitly recorded source YEA/NAY fingerprint to the opening absent roster.

An opening-absent yet named-side record is a **human HOLD flag**, not permission to silently change either source. Opening absence, roll-time absence, inability to vote, abstention, and Pass are **not equivalent**. A missing member or absence cannot be guessed from source aggregate numeric results. The original record may repeat the same recommendation in prose; multiple similar numeric candidate blocks are not proved distinct actual motions until original paragraph and bill/amendment boundaries are independently reviewed.

**Critical:** source SHA success or attendance consistency does **not** establish these as 13 separately certified historical votes, the full 2021-25 universe, production persisted database equality, or model eligibility. After the actual one-time workflow succeeds, inspect its original artifacts and pin run ID, artifact ZIP/JSON SHA and source hashes in a permanent immutable regression-tested proof ledger before declaring the source proof durable. No private production database read/write, forecast/model/training/serving/scheduler/2027, Senate floor expansion or government-office contact. **Keep issue #864 OPEN.**
