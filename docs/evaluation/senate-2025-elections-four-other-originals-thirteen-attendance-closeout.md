# #864 — final original opening-attendance check for 13 provisional 2025 Elections rolls

**Scope:** source-only audit of four original 2025 Minnesota Senate Elections Committee minutes PDFs and their 13 provisional named-roll paragraphs; reviewed October 10, 2026 CDT, original re-fetch October 11 UTC. This is **not** an official 2021–25 vote denominator, a production member-vote certification, or proof of physical attendance at the exact time of a motion.

## Actual original-source run and first failure

The first [run #38098209877](https://github.com/killjoy00/votepredict/actions/runs/38098209877) correctly failed closed because its original-minutes opening roster parser hardcoded Senator Carlson as the calling chair. That run checked only the first **three** original PDFs and **eight** roll offsets successfully; it **must not** be counted as four-PDF success. Merged [PR #970](https://github.com/killjoy00/votepredict/pull/970) permits any explicitly named calling senator while still requiring an exact, nonduplicated official eleven-member opening roster.

The actual [successful source run #38098600457](https://github.com/killjoy00/votepredict/actions/runs/38098600457) independently re-fetched **four of four** SHA-pinned original PDFs, verified their independent extracted-text SHA256, all **13** pinned source offsets, the contemporaneous post-February 3 Elections membership, original numeric side totals and all opening Present/Absent rosters. Zero PDF/text SHA or parsing errors; zero indexed-versus-printed date conflicts for these four originals; zero explicit named YEA/NAY sides for members marked absent at opening. Four original opening rosters each show **11 Present, 0 Absent**. This only checks opening attendance, not motion-time attendance.

| Original official hearing | Reverified source offsets | Candidate named-roll paragraphs | Named source choices |
| --- | --- | ---: | ---: |
| [Feb 6, 2025](https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250206/Elections_20250206_Minutes.pdf) | 1574, 1991, 2250, 2522, 2946 | 5 | 55 |
| [Feb 11, 2025](https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250211/Elections_20250211_Minutes.pdf) | 2354, 3460 | 2 | 22 |
| [Mar 25, 2025](https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250325/Elections_20250325_Minutes.pdf) | 1326 | 1 | 11 |
| [Apr 8, 2025](https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250408/Elections_20250408_Minutes.pdf) | 2133, 2401, 2673, 2941, 3303 | 5 | 55 |
| **Total** | **13** | **13 provisional candidates** | **143 (72 YEA / 71 NAY)** |

The permanent [source-proof ledger](./source-proof/senate-2025-elections-four-other-originals-thirteen-attendance-source-proof.json) records each original URL, binary and extracted-text SHA, source byte length, exact text offset and nearby-context SHA, opening attendance counts, and the unsuccessful and successful run identities. Source artifact **11686399026** was independently downloaded and verified: ZIP SHA256 **140604c8c7c08f7674b52e610bfeb9a58118d277e861971bbf32dd0eab55d019**; decoded JSON SHA256 **cf9e481ca405e1ddcd92cccbaf3387bdaf8c256888d805a2e873fec8d49e64d3**. The test [thirteen-attendance-source-proof.test.ts](../../tests/senate-2025-elections-four-other-originals-thirteen-attendance-source-proof.test.ts) locks the exact original run, ledger Git blob and independent 19-candidate queue offsets.

## Complete bounded 2025 Elections candidate cohort and remaining holds

Combining these **13 / 143** with the separately original-source-audited February 13 and March 27 **2 / 20** gives **six actual original PDFs, 15 provisional named-roll source blocks and 163 explicit YEA/NAY source tokens**. The **Feb 13** original wrongly prints Feb 27 and lists three members absent at opening who nevertheless have explicit YEA/NAY sides in the recorded SF1071 roll. The **Mar 27** original wrongly prints May 27; its SF905 nine named sides and two absent members agree internally, but its heading and independently uncorroborated vote specifics remain held. Both historical votes are **HOLD** for automatic individual-vote promotion.

For the other 13 source blocks, eleven historically eligible surnames and side counts matching a single original paragraph **do not by themselves establish that every paragraph represents a unique action, an independent vote witness, or a final bill stance**. February 6 includes different SF529 amendment, tabling and committee recommendation motions; see [provisional motion identity review](./senate-2025-elections-feb06-five-roll-motion-context.md). February 11, March 25 and April 8 still require original paragraph-by-paragraph distinct-motion review.

**Dating rule:** per the owner's explicit #864 historical convention, official-minute meeting actions use the hearing date as both action date and available-on date, subject to exclusion from same-day forecast cutoffs when motion time is not independently proved. The October 2026/2026 UTC source re-download timestamp is separate provenance; it is **not** a new publication gate. This convention does not establish an independently verified historical web publication timestamp for the PDF itself or extend to campaign/CFB/media materials.

**Non-promotion:** The run made no private production database reads/writes and no model, forecast, training, serving, scheduler, floor, 2027 or office-contact changes. The 2021 print-only and 2022 mixed source boundary, the 141 unlinked electronic minutes entries, and actual statewide official committee vote denominator are unresolved. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) **OPEN** until source-to-database reconciliation.
