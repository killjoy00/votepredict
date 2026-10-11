# #864 — April 3, 2023 Minnesota Senate Transportation / SF3157 roll-call minutes

**Committee only — not the Senate floor.** New historical 2023 source area from the [Minnesota Senate's own Transportation Committee minutes](https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=17939&ls=93&type=minutes), hearing **Monday, April 3, 2023**, state Senate session 93, hearing ID **17939**. The original page records **nine present** and **Coleman absent** at opening, but the individual rolls record additional changing absences; motion-specific printed choices must always supersede the opening attendance list.

## Seven separate printed, named amendment roll sections

| Subject moved in the official minutes | Mover | YES / NO / absent named | Disposition | Audit status |
| --- | --- | --- | --- | --- |
| A28 amendment | Jasinski | 8 / 0 / 2 | Adopted | One source paragraph |
| A17 amendment | Howe | 2 / 6 / 2 | Failed | One source paragraph |
| A20 amendment | Jasinski | 5 / 4 / 1 | Adopted | One source paragraph |
| A35 amendment | Jasinski | 3 / 6 / 1 | Failed | One source paragraph |
| A30 amendment | Howe | 3 / 5 / 2 | Failed | One source paragraph |
| A26 amendment | Jasinski | 2 / 6 / 2 | Failed | One source paragraph |
| Oral amendment to A49 | Howe | 2 / 6 / 2 | Failed | **HOLD: final printed sentence mislabels amendment A26** |

These are **seven distinct named roll *paragraphs*** in official minutes, *not* proof of seven new rows absent from VotePredict. Six have internally consistent amendment labels in the source. The seventh **introduces Howe's oral amendment to A49 and explicitly says the roll is on that proposed oral amendment**, but the immediately adjacent closing sentence incorrectly labels it as *A26* not adopted. Another, separately recorded **Jasinski A26** 2/6/2 failed roll exists earlier in the same meeting. **Never** merge the oral A49 paragraph into A26 merely because its result is printed as A26, and do not silently repair the original source. Independently corroborate using original hearing audiovisual or filed amendments before treating the seventh as a fully resolved historical action.

The original page also describes many different **voice-vote adoptions and failures**, amendments explicitly **withdrawn**, and A10 **laid on the table and later withdrawn**. None has individual YEA/NAY sides inferred from its voice result or the committee roster. Its final SF3157 committee recommendation to pass as amended and refer to the **Taxes Committee** was **by voice vote**, not a member-named final-passage division. This is a **committee** recommendation, not a Senate floor vote.

## First official HTML source run: fetched, but parser FAILED

After merged [PR #1078](https://github.com/killjoy00/votepredict/pull/1078) passed exact-head full CI, the one-time [actual original HTML source run #38158242090](https://github.com/killjoy00/votepredict/actions/runs/38158242090) **downloaded 78,781 bytes of official Senate HTML**, calculated original response SHA256 `efbcf9bf503fcde638854a244748959e89ed336079099a51a44a16bb9bc1c203` and normalized visible text SHA256 `ede07baa4f72e29b009310039bc8cde0011bc0148ab530b711b1e9a7542f7a82`; then **FAILED** its first A28 roll-section parser invariant (`Original named roll has no bounded disposition for A28`). **No seven-roll machine certification occurred.** Its independently downloaded artifact #11708857555 has ZIP SHA256 `6a4d5998d2dd250b3fc82197325ffb22165130eef5c27bdef7fe48b31d6cbe55` / 916 bytes and decoded JSON SHA256 `3f2bdd8aa68a6fd32ecf13b0d3362eb52fef8ca38125f2110b504ce6e6b0546b` / 1,242 bytes.

The parser had not decoded named HTML curly quotation entities like `&ldquo;`/`&rdquo;` before looking for source phrases containing “yes” and “no.” A new fake-roster regression now tests *encoded* original-style HTML and keeps all roster/tally/source guards unchanged. This is a **plausible, not yet proven** explanation for the first parser failure; no source text or vote is rewritten. The exact first failed result is frozen in [first-failure proof](source-proof/senate-2023-transportation-apr03-original-html-first-parse-failure.json) and [regression](../../tests/senate-2023-transportation-apr03-original-html-first-failure.test.ts). Only the **separate, on-merge one-time [HTML entity retry](../../.github/workflows/senate-2023-transportation-apr03-sf3157-html-entities-retry.yml)** may establish a newly successful original source parse after its actual ZIP/JSON artifact is independently verified. The old failure remains failure and Howe A49/A26 remains unresolved.

## Exact original public-source proof and limitations

The [standalone source parser](../../src/evidence/senate-2023-transportation-apr03-sf3157-source.ts), [one-time original HTML retrieval workflow](../../.github/workflows/senate-2023-transportation-apr03-sf3157-original.yml) and [fictional-roster test suite](../../tests/senate-2023-transportation-apr03-sf3157-source.test.ts) are designed to make a fresh independent observation of the exact official hearing URL, bounded MIME and HTML bytes, committee date/bill, seven individually named ten-member YES/NO/Absent partitions, and *exactly one* A49/A26 contradictory closing label. The source report hashes the live HTML bytes and normalized visible text separately, and records SHA256 *identities* for explicitly printed individual side choices. **No full source HTML or unhashed member-by-side list is committed.**

**Important:** These provisional human-reviewed source identities are not a successful byte-authenticated machine run until the real one-time GitHub Actions job executes, its actual artifact ZIP and decoded JSON are independently downloaded and SHA256-verified, and any source failure is preserved as failure. Historical event date **2023-04-03** is the hearing-day convention, *not* proof of a minute-level first-public-by time; no same-day forecast use without separate precise motion timestamp. No record should be inserted into member_vote, nor any new statewide denominator increment inferred from the count of paragraphs. No private/production DB access or writes, model/training/serving/scheduler/floor/2027 changes or government contact.

Across 2021–2025 the true statewide committee recorded-vote denominator and private evidence parity remain unverified. The pre-2023 **2021 print-only and 2022 print-versus-electronic** collection holds and the seven caption access exceptions remain outstanding. **Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN.**
