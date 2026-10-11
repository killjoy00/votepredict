# #864 – Correct April 12, 2021 Rule 12.10 source interpretation

**Authoritative evidence: three distinct COMMITTEE amendment motions, not two.** On October 11, a later experimental parser introduced in #1134–#1137 wrongly treated the second `SF1159` 4–6 published passage as an unanchored duplicate. That inference was **incorrect**: the earlier independently authenticated strict original-Journal source evidence already established the second as a **McEwen amendment**, separate from the first **Dibble amendment**. The same committee report heading covers both motions. Two bill references in an index do not imply only two amendment motions.

| Original Journal report | Bill | Different amendment identity | Committee | Printed result |
|---|---|---|---|---|
| 2021-04-12, p2086 | SF1159 | Dibble amendment, #1 | Transportation Finance and Policy | 4 YEA / 6 NAY, not adopted |
| 2021-04-12, p2086 | SF1159 | McEwen amendment, #2 | Transportation Finance and Policy | 4 YEA / 6 NAY, not adopted |
| 2021-04-12, p2147 | SF970 | Pappas amendment | Judiciary and Public Safety Finance and Policy | 3 YEA / 6 NAY, not adopted |

Both SF1159 amendments have **identical authenticated named YEA/NAY side SHA commitments** yet different amendment sponsors and separate original motion offsets/context SHA values. They must never be deduplicated into one vote. The report date does not independently establish motion/hearing time or historical first-public-by timing. Absent votes are not separately printed: **null**, never an inferred zero.

## Definitive source of truth

- Official [April 12, 2021 Senate Journal original PDF](https://www.senate.mn/journals/2021-2022/20210412036.pdf): **11,063,699 bytes**, SHA256 `8dd34868badade8d3d4cd77ce11c6a632705bdd99a59509a5e4d23544f2d3d75`; embedded text SHA256 `dda780e4fc076f56ff9f271303ba81897b69813acfece416b7741aea64c41214`.
- [Original first-pass workflow #38170792094](https://github.com/killjoy00/votepredict/actions/runs/38170792094): initial **provisional** three-motion source discovery, deliberately not a final named-roll certification. Implemented #1130.
- [Strict independent original-source workflow #38171360478](https://github.com/killjoy00/votepredict/actions/runs/38171360478): **SUCCESS / 3 out of 3 motion-specific YEA/NAY commitments**, zero source errors, implemented in #1131 and preserved by merged [#1133](https://github.com/killjoy00/votepredict/pull/1133).
- Strict original source artifact #11714178531: ZIP **1,773 bytes**, SHA256 `fd4e2c1d95c2427faf495751df463acc9b1880ab56ffb283b7b0caa5f1f4af5f`; decoded JSON **5,556 bytes**, SHA256 `3eaf9d2559b75579bcda3ff2602b7a95f17f66d5b3896ea0013039cc9b94a796`.
- **Use** `src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.ts` and `docs/evaluation/source-proof/senate-2021-apr12-three-strict-rule1210-original-committee-success.json` for any subsequent evidence work. These source-proofs emit only hashes for historical named choices, never readable senator-vote side rosters.

## Retired inaccurate experiment and immutability of failures

The experimental *two-motion-only* parser, script, synthetic tests, and three one-time original-source workflows are removed. Do **not** retrigger or repair them, because their foundational assumption is superseded. The historic failure artifacts and exact original binary/text SHA commitments remain preserved:

1. Genuine original run [#38172259470](https://github.com/killjoy00/votepredict/actions/runs/38172259470): FAILED on a one-hex-character extracted-text-SHA transcription error in the experimental code.
2. Genuine original run [#38172682467](https://github.com/killjoy00/votepredict/actions/runs/38172682467): FAILED because experimental code incorrectly required one unique SF1159 amendment per bill. The second passage was incorrectly called a duplicate, now corrected.
3. Genuine original run [#38173089761](https://github.com/killjoy00/votepredict/actions/runs/38173089761): FAILED on that experimental path's original 450-character motion-window digest check. Original 11 MB binary acquisition was successful and unchanged; exact failure remains `SF1159 authentic motion-and-voter window SHA mismatch`. Artifact #11714807052, ZIP SHA `08fb2e2dea7b7163b5cfc58e45a72332010f2c9618089ce9821af59dc2044bee`, decoded JSON SHA `0cb66a32796c39952eb516b83b8b95f349803f65d1c9a08ff01570447c5910ee`.

All three failed jobs **remain failures**, irrespective of the separately proven successful strict three-motion original-source check. Historic redacted layouts and two-index-lead source JSONs may still aid forensic audits; they **must not** be used to assert that only two actual amendment votes occurred.

## Scope boundaries

The authenticated original Journal motions are not Minnesota Senate floor votes, whole-bill passage recommendations, or evidence of missing privately stored VotePredict `member_vote` rows. They do not establish exhaustive 2021–2025 committee vote coverage, independent LRL printed-minute parity, or actual historical vote/cutoff timestamps. This cleanup accesses no protected production database and changes no models, forecasting, scheduler, floor datasets, or 2027 assumptions. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) **OPEN**.
